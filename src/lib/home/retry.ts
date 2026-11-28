/** The waits before a second and a third try, in milliseconds. */
export const RETRY_WAITS: readonly number[] = [300, 1200];

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Runs one read, and runs it again after a wait when it fails (TIN-8657).
 * A phone that changes network as a page opens loses every request in flight, and the next try answers.
 * The last failure is thrown, so a file that is truly gone still fails.
 */
export async function withRetries<T>(read: () => Promise<T>, waits: readonly number[] = RETRY_WAITS, wait: (ms: number) => Promise<void> = pause): Promise<T> {
	for (let tries = 0; ; tries += 1) {
		try {
			return await read();
		} catch (error) {
			if (tries >= waits.length) throw error;
			await wait(waits[tries]);
		}
	}
}
