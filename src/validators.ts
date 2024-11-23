import type { Channel, Strip, Validator } from './types.ts';

import { STRIP_TYPES } from './types.ts';

function validate<T>(validators: Validator<T>): (value: unknown) => value is T {
	return ((value: unknown): value is T => {
		if (typeof value !== 'object' || value === null) return false;

		return Object.keys(validators).every((key) => {
			return validators[key as keyof T]((value as Record<string, unknown>)[key]);
		});
	});
}

export const strip = validate<Strip>({
	'frequency': (value) => typeof value === 'number' && value >= 400000 && value <= 800000,
	'dma': (value) => typeof value === 'number' && [8, 9, 10, 11, 12, 13, 14].includes(value),
	'channels': (value) => Array.isArray(value) && (value.length === 1 || value.length === 2) && value.every(channel),
});

const channel = validate<Channel>({
	'gpio': (value) => typeof value === 'number' && [10, 12, 13, 18, 19, 21, 31, 38, 40, 41, 45, 52, 53].includes(value),
	'invert': (value) => typeof value === 'boolean',
	'count': (value) => typeof value === 'number' && value > 0,
	'strip': (value) => typeof value === 'string' && value in STRIP_TYPES,
	'brightness': (value) => typeof value === 'number' && value >= 0 && value <= 255,
});
