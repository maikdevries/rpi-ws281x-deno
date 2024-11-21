// [REF] https://github.com/jgarff/rpi_ws281x/blob/7fc0bf8b31d715bbecf28e852ede5aaa388180da/ws2811.h#L47
export const STRIP_TYPES = {
	SK6812_RGBW: 0x18100800,
	SK6812_RBGW: 0x18100008,
	SK6812_GRBW: 0x18081000,
	SK6812_GBRW: 0x18080010,
	SK6812_BRGW: 0x18001008,
	SK6812_BGRW: 0x18000810,

	WS2811_RGB: 0x00100800,
	WS2811_RBG: 0x00100008,
	WS2811_GRB: 0x00081000,
	WS2811_GBR: 0x00080010,
	WS2811_BRG: 0x00001008,
	WS2811_BGR: 0x00000810,

	WS2812: 0x00081000,
	SK6812: 0x00081000,
	SK6812W: 0x18081000,
} as const;

// [REF] https://github.com/jgarff/rpi_ws281x/blob/7fc0bf8b31d715bbecf28e852ede5aaa388180da/ws2811.h#L71
export interface Channel {
	gpio: 10 | 12 | 13 | 18 | 19 | 21 | 31 | 38 | 40 | 41 | 45 | 52 | 53;
	invert: boolean;
	count: number;
	strip: keyof typeof STRIP_TYPES;
	brightness: number;
}

// [REF] https://github.com/jgarff/rpi_ws281x/blob/7fc0bf8b31d715bbecf28e852ede5aaa388180da/ws2811.h#L86
export interface Strip {
	frequency: number;
	dma: 8 | 9 | 10 | 11 | 12 | 13 | 14;
	channels: [Channel, Channel];
}

// [REF] https://github.com/jgarff/rpi_ws281x/blob/7fc0bf8b31d715bbecf28e852ede5aaa388180da/ws2811.h#L96
export const STATUS = {
	SUCCESS: 0,
	ERROR_GENERIC: -1,
	ERROR_OUT_OF_MEMORY: -2,
	ERROR_HARDWARE_NOT_SUPPORTED: -3,
	ERROR_MEMORY_LOCK: -4,
	ERROR_MMAP: -5,
	ERROR_MAP_REGISTERS: -6,
	ERROR_GPIO_INIT: -7,
	ERROR_PWM_SETUP: -8,
	ERROR_MAILBOX_DEVICE: -9,
	ERROR_DMA: -10,
	ERROR_ILLEGAL_GPIO: -11,
	ERROR_PCM_SETUP: -12,
	ERROR_SPI_SETUP: -13,
	ERROR_SPI_TRANSFER: -14,
} as const;

export interface Control {
	leds: Uint32Array;
	brightness: Uint8Array;
}
