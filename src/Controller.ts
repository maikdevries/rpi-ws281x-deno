import type { Channel, ChannelConfiguration, ChannelData, Strip, StripConfiguration } from './types.ts';

import Driver from './Driver.ts';

export default class Controller {
	private readonly driver: Driver;

	public readonly first: Control;
	public readonly second: Control | undefined;

	private static defaults: Strip = {
		'frequency': 800000,
		'dma': 10,
		'channels': [
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
			'channels': config.channels.map((channel, i) => ({
				...Controller.defaults.channels[i],
				...channel,
			})) as [Channel] | [Channel, Channel],
		});

		const [first, second] = this.driver.retrieveChannels();
		this.first = new Control(first, this.driver.render.bind(this.driver));
		this.second = second ? new Control(second, this.driver.render.bind(this.driver)) : undefined;
	}

	public shutdown(): void {
		this.first.flush();
		this.second?.flush();

		return this.driver.finalise();
	}
}

class Control {
	constructor(private readonly channel: ChannelData, private readonly render: () => void) {}

	set brightness(value: number) {
		if (value < 0 || value > 255) throw new RangeError('Channel brightness must be an integer in range [0, 255]');

		this.channel.brightness.set([value]);
		this.render();
	}

	set colour(value: number[]) {
		if (!value.length || !value.every((v) => typeof v === 'number' && v >= 0x00000000 && v <= 0xFFFFFFFF)) {
			throw new RangeError('Channel colour must be an array of integers in range [0x00000000, 0xFFFFFFFF]');
		}

		this.channel.leds.forEach((_, i) => this.channel.leds[i] = value[i % value.length] as number);
		this.render();
	}

	public flush(): void {
		this.channel.leds.fill(0x00000000);
		this.render();
	}
}
