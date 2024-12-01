import type { ChannelData, Strip } from './types.ts';

import meta from './../deno.json' with { 'type': 'json' };
import { dlopen } from '@denosaurs/plug';
import { STATUS, STRIP_TYPES } from './types.ts';
import * as validate from './validators.ts';

const bindings = await dlopen(
	{
		'url': new URL(`${meta.name}/${meta.version}/lib/ws2811.so`, 'https://jsr.io'),
	},
	{
		ws2811_init: { parameters: ['buffer'], result: 'i32' },
		ws2811_fini: { parameters: ['buffer'], result: 'void' },
		ws2811_render: { parameters: ['buffer'], result: 'i32' },
		// ws2811_wait: { parameters: ['buffer'], result: 'i32' },
		// ws2811_set_custom_gamma_factor: { parameters: ['buffer', 'f64'], result: 'void' },
	} as const,
);

// [NOTE] Read and write permissions are no longer required after fetching shared library binary
Deno.permissions.revokeSync({ 'name': 'read' });
Deno.permissions.revokeSync({ 'name': 'write' });

export default class Driver {
	private static ENDIANNESS = true;

	private buffer: Uint8Array | null;
	private view: DataView | null;

	constructor(private readonly config: Strip) {
		if (!validate.strip(config)) throw new Error('Strip configuration must be valid');

		[this.buffer, this.view] = Driver.allocate(this.config);

		if (bindings.symbols.ws2811_init(this.buffer) !== STATUS.SUCCESS) {
			this.finalise();
			throw new Error('Failed to initialise driver');
		}
	}

	// [REF] https://github.com/jgarff/rpi_ws281x/blob/7fc0bf8b31d715bbecf28e852ede5aaa388180da/ws2811.h#L86
	private static allocate(config: Strip): [Uint8Array, DataView] {
		const buffer = new Uint8Array(112);
		if (buffer?.length !== 112) throw new Error('Failed to allocate memory for driver initialisation');

		const view = new DataView(buffer.buffer);
		let offset = 0;

		// [TYPE] uint64_t ws2811_t.render_wait_time
		offset += 8;

		// [TYPE] * ws2811_t.device
		offset += 8;

		// [TYPE] * ws2811_t.rpi_hw
		offset += 8;

		// [TYPE] uint32_t ws2811_t.freq
		view.setUint32(offset, config.frequency, Driver.ENDIANNESS);
		offset += 4;

		// [TYPE] int ws2811_t.dmanum
		view.setInt32(offset, config.dma, Driver.ENDIANNESS);
		offset += 4;

		for (const channel of config.channels) {
			// [TYPE] int ws2811_channel_t.gpionum
			view.setInt32(offset, channel.gpio, Driver.ENDIANNESS);
			offset += 4;

			// [TYPE] int ws2811_channel_t.invert
			view.setInt32(offset, Number(channel.invert), Driver.ENDIANNESS);
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
			view.setUint8(offset, channel.brightness);
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
		if (!pointer) throw new Error('Failed to retrieve pointer to LED buffer');

		const buffer = new Uint32Array(Deno.UnsafePointerView.getArrayBuffer(pointer, size * 4));
		if (buffer?.length !== size) throw new Error('Failed to retrieve LED buffer from pointer');

		return buffer;
	}

	public retrieveChannels(): [ChannelData] | [ChannelData, ChannelData] {
		if (!this.buffer?.length || !this.view) throw new Error('Driver must be initialised before retrieving channels');

		try {
			const channels: [ChannelData] | [ChannelData, ChannelData] = [
				{
					'leds': Driver.retrieve(this.view, 48, this.config.channels[0].count),
					'brightness': this.buffer.subarray(56, 57),
				},
				(this.config.channels[1] && {
					'leds': Driver.retrieve(this.view, 88, this.config.channels[1].count),
					'brightness': this.buffer.subarray(96, 97),
				}) as ChannelData,
			];

			// [NOTE] FFI permissions are no longer required after initialisation
			Deno.permissions.revokeSync({ 'name': 'ffi' });

			return channels;
		} catch (error: unknown) {
			this.finalise();
			throw error;
		}
	}

	public finalise(): void {
		if (!this.buffer?.length || !this.view) throw new Error('Driver must be initialised before finalising');

		bindings.symbols.ws2811_fini(this.buffer);

		this.buffer = null;
		this.view = null;

		return bindings.close();
	}

	public render(): void {
		if (!this.buffer?.length || !this.view) throw new Error('Driver must be initialised before rendering');

		if (bindings.symbols.ws2811_render(this.buffer) !== STATUS.SUCCESS) {
			this.finalise();
			throw new Error('Failed to render LED buffer');
		}
	}
}
