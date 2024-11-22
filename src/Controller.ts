import type { Channel, ChannelConfiguration, Strip, StripConfiguration } from './types.ts';

import Driver from './Driver.ts';

export default class Controller {
	private readonly driver: Driver;

	private static defaults: Strip = {
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

	constructor(config: StripConfiguration<ChannelConfiguration>) {
		this.driver = new Driver({
			'frequency': config.frequency ?? Controller.defaults.frequency,
			'dma': config.dma ?? Controller.defaults.dma,
			channels: config.channels.map((channel, i) => ({
				...Controller.defaults.channels[i],
				...channel,
			})) as [Channel] | [Channel, Channel],
		});
	}
}
