import type { Channel, Control, Strip } from './types.ts';

import { STATUS, STRIP_TYPES } from './types.ts';

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

export default class Driver {
	// [TODO]
	private static ENDIANNESS = true;

	private buffer: Uint8Array | null;
	private view: DataView | null;

	private static defaults: Required<Strip> = {
		'frequency': 800000,
		'dma': 10,
		channels: [
			{
				'gpio': 18,
				'invert': false,
				'count': 0,
				'strip': 'WS2812',
				'brightness': 255,
			},
			{
				'gpio': 13,
				'invert': false,
				'count': 0,
				'strip': 'WS2812',
				'brightness': 255,
			},
		],
	};

	constructor(private readonly config: Strip) {
		[this.buffer, this.view] = Driver.allocate(this.config);

		if (bindings.symbols.ws2811_init(this.buffer) !== STATUS.SUCCESS) throw new Error();
	}

	// [REF] https://github.com/jgarff/rpi_ws281x/blob/7fc0bf8b31d715bbecf28e852ede5aaa388180da/ws2811.h#L86
	private static allocate(config: Strip): [Uint8Array, DataView] {
		// [NOTE] Allocate memory through Uint8Array for optimised performance
		const buffer = new Uint8Array(32 + (config.channels.length * 40));
		if (!buffer?.length) throw new Error();

		const view = new DataView(buffer.buffer);
		let offset = 0;

		// [TYPE] uint64_t ws2811_t.render_wait_time
		offset += 8;

		// [TYPE] * ws2811_t.device
		offset += 8;

		// [TYPE] * ws2811_t.rpi_hw
		offset += 8;

		// [TYPE] uint32_t ws2811_t.freq
		view.setUint32(offset, config.frequency ?? Driver.defaults.frequency, Driver.ENDIANNESS);
		offset += 4;

		// [TYPE] int ws2811_t.dmanum
		view.setInt32(offset, config.dma ?? Driver.defaults.dma, Driver.ENDIANNESS);
		offset += 4;

		for (const [i, channel] of config.channels.entries()) {
			const defaults = Driver.defaults.channels[i] as Required<Channel>;

			// [TYPE] int ws2811_channel_t.gpionum
			view.setInt32(offset, channel.gpio ?? defaults.gpio, Driver.ENDIANNESS);
			offset += 4;

			// [TYPE] int ws2811_channel_t.invert
			view.setInt32(offset, Number(channel.invert ?? defaults.invert), Driver.ENDIANNESS);
			offset += 4;

			// [TYPE] int ws2811_channel_t.count
			view.setInt32(offset, channel.count, Driver.ENDIANNESS);
			offset += 4;

			// [TYPE] int ws2811_channel_t.strip_type
			view.setInt32(offset, STRIP_TYPES[channel.strip], Driver.ENDIANNESS);
			offset += 4;

			// [TYPE] * ws2811_channel_t.leds
			offset += 8;

			// [TYPE] uint8_t ws2811_channel_t.brightness
			view.setUint8(offset, channel.brightness ?? defaults.brightness);
			offset += 1;

			// [TYPE] uint8_t ws2811_channel_t.wshift
			offset += 1;

			// [TYPE] uint8_t ws2811_channel_t.rshift
			offset += 1;

			// [TYPE] uint8_t ws2811_channel_t.gshift
			offset += 1;

			// [TYPE] uint8_t ws2811_channel_t.bshift
			offset += 1;

			// [NOTE] Additional padding to align offset to multiple of 4 bytes
			offset += 3;

			// [TYPE] * ws2811_channel_t.gamma
			offset += 8;
		}

		return [buffer, view];
	}

	private static retrieve(view: DataView, offset: number, size: number): Uint32Array {
		const pointer = Deno.UnsafePointer.create(view.getBigUint64(offset, Driver.ENDIANNESS));
		if (!pointer) throw new Error();

		const buffer = new Uint32Array(Deno.UnsafePointerView.getArrayBuffer(pointer, size * 4));
		if (!buffer?.length) throw new Error();

		return buffer;
	}

	public retrieveControls(): [Control, Control] {
		if (!this.buffer?.length || !this.view) throw new Error();

		return [
			{
				'leds': Driver.retrieve(this.view, 48, this.config.channels[0].count),
				'brightness': this.buffer.subarray(56, 57),
			},
			{
				'leds': Driver.retrieve(this.view, 88, this.config.channels[1].count),
				'brightness': this.buffer.subarray(96, 97),
			},
		];
	}

	public finalise(): void {
		if (!this.buffer?.length || !this.view) throw new Error();

		bindings.symbols.ws2811_fini(this.buffer);

		this.buffer = null;
		this.view = null;

		return bindings.close();
	}

	public render(): void {
		if (!this.buffer?.length || !this.view) throw new Error();

		if (bindings.symbols.ws2811_render(this.buffer) !== STATUS.SUCCESS) throw new Error();
	}
}
