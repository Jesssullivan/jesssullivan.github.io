import { describe, expect, it } from 'vitest';
import { RETRY_WAITS, withRetries } from './retry';

/** A wait that takes no time and writes down how long it was asked for. */
function waits() {
	const asked: number[] = [];
	return { asked, wait: async (ms: number) => void asked.push(ms) };
}

describe('withRetries', () => {
	it('reads once and waits for nothing when the first try answers', async () => {
		const { asked, wait } = waits();
		let tries = 0;
		expect(await withRetries(async () => ++tries, RETRY_WAITS, wait)).toBe(1);
		expect(asked).toEqual([]);
	});

	it('tries again after the first wait when the first try fails', async () => {
		const { asked, wait } = waits();
		let tries = 0;
		const read = async () => {
			tries += 1;
			if (tries === 1) throw new TypeError('Failed to fetch');
			return 'stream';
		};
		expect(await withRetries(read, RETRY_WAITS, wait)).toBe('stream');
		expect(tries).toBe(2);
		expect(asked).toEqual([300]);
	});

	it('gives up after three tries and throws the last failure', async () => {
		const { asked, wait } = waits();
		let tries = 0;
		const read = async () => {
			tries += 1;
			throw new Error(`try ${tries}`);
		};
		await expect(withRetries(read, RETRY_WAITS, wait)).rejects.toThrow('try 3');
		expect(tries).toBe(3);
		expect(asked).toEqual([300, 1200]);
	});

	it('waits no longer than 1.5 seconds in all', () => {
		expect(RETRY_WAITS.reduce((sum, ms) => sum + ms, 0)).toBeLessThanOrEqual(1500);
	});
});
