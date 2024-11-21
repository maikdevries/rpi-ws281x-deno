import type { Control, Strip } from './types.ts';

import { STRIP_TYPES } from './types.ts';

const bindings = Deno.dlopen(
	'./lib/ws2811.so',
	{
		ws2811_init: { parameters: ['buffer'], result: 'i32' },
		ws2811_fini: { parameters: ['buffer'], result: 'void' },
		ws2811_render: { parameters: ['buffer'], result: 'i32' },
		// ws2811_wait: { parameters: ['buffer'], result: 'i32' },
		ws2811_set_custom_gamma_factor: { parameters: ['buffer', 'f64'], result: 'void' },
	} as const,
);

export default class Controller {
	// [TODO]
	private static ENDIANNESS = true;

	private buffer: Uint8Array;
	private view: DataView;

	constructor(private readonly config: Strip) {
		[this.buffer, this.view] = Controller.allocate(this.config);

		bindings.symbols.ws2811_init(this.buffer);
	}

	// [REF] https://github.com/jgarff/rpi_ws281x/blob/7fc0bf8b31d715bbecf28e852ede5aaa388180da/ws2811.h#L86
	private static allocate(config: Strip): [Uint8Array, DataView] {
		// [NOTE] Allocate memory through Uint8Array for optimised performance
		const buffer = new Uint8Array(32 + (config.channels.length * 40));
		const view = new DataView(buffer.buffer);
		let offset = 0;

		// [TYPE] uint64_t ws2811_t.render_wait_time
		view.setBigUint64(offset, config.timeout, Controller.ENDIANNESS);
		offset += 8;

		// [TYPE] * ws2811_t.device
		view.setBigUint64(offset, config.device, Controller.ENDIANNESS);
		offset += 8;

		// [TYPE] * ws2811_t.rpi_hw
		view.setBigUint64(offset, config.hardware, Controller.ENDIANNESS);
		offset += 8;

		// [TYPE] uint32_t ws2811_t.freq
		view.setUint32(offset, config.frequency, Controller.ENDIANNESS);
		offset += 4;

		// [TYPE] int ws2811_t.dmanum
		view.setInt32(offset, config.dma, Controller.ENDIANNESS);
		offset += 4;

		for (const channel of config.channels) {
			// [TYPE] int ws2811_channel_t.gpionum
			view.setInt32(offset, channel.gpio, Controller.ENDIANNESS);
			offset += 4;

			// [TYPE] int ws2811_channel_t.invert
			view.setInt32(offset, Number(channel.invert), Controller.ENDIANNESS);
			offset += 4;

			// [TYPE] int ws2811_channel_t.count
			view.setInt32(offset, channel.count, Controller.ENDIANNESS);
			offset += 4;

			// [TYPE] int ws2811_channel_t.strip_type
			view.setInt32(offset, STRIP_TYPES[channel.strip], Controller.ENDIANNESS);
			offset += 4;

			// [TYPE] * ws2811_channel_t.leds
			view.setBigUint64(offset, channel.leds, Controller.ENDIANNESS);
			offset += 8;

			// [TYPE] uint8_t ws2811_channel_t.brightness
			view.setUint8(offset, channel.brightness);
			offset += 1;

			// [TYPE] uint8_t ws2811_channel_t.wshift
			view.setUint8(offset, channel.white);
			offset += 1;

			// [TYPE] uint8_t ws2811_channel_t.rshift
			view.setUint8(offset, channel.red);
			offset += 1;

			// [TYPE] uint8_t ws2811_channel_t.gshift
			view.setUint8(offset, channel.green);
			offset += 1;

			// [TYPE] uint8_t ws2811_channel_t.bshift
			view.setUint8(offset, channel.blue);
			offset += 1;

			// [NOTE] Additional padding to align offset to multiple of 4 bytes
			offset += 3;

			// [TYPE] * ws2811_channel_t.gamma
			view.setBigUint64(offset, channel.gamma, Controller.ENDIANNESS);
			offset += 8;
		}

		return [buffer, view];
	}

	private static retrieve(view: DataView, offset: number, size: number): Uint32Array {
		const pointer = Deno.UnsafePointer.create(view.getBigUint64(offset, Controller.ENDIANNESS));
		if (!pointer) throw new Error();

		const buffer = new Uint32Array(Deno.UnsafePointerView.getArrayBuffer(pointer, size * 4));
		if (!buffer?.length) throw new Error();

		return buffer;
	}

	public retrieveControls(): [Control, Control] {
		return [
			{
				'leds': Controller.retrieve(this.view, 48, this.config.channels[0].count),
				'brightness': this.buffer.subarray(56),
			},
			{
				'leds': Controller.retrieve(this.view, 88, this.config.channels[1].count),
				'brightness': this.buffer.subarray(96),
			},
		];
	}
}
