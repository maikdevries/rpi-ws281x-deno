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
