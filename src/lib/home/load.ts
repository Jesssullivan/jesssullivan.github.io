import type { StreamFile } from './stream';

/** The one data file of the home stream, written by scripts/generate-home-stream.mts (TIN-8657). */
export const HOME_STREAM_PATH = '/data/home-stream.v1.json';

export type StreamFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** One same-origin read of a committed file. Nothing here asks another host for anything. */
export async function loadHomeStream(fetchFn: StreamFetch): Promise<StreamFile> {
	const response = await fetchFn(HOME_STREAM_PATH);
	if (!response.ok) throw new Error(`home stream fetch failed: ${response.status} (${HOME_STREAM_PATH})`);
	const data = (await response.json()) as StreamFile;
	if (data?.version !== 1 || !Array.isArray(data.items) || !Array.isArray(data.heading)) throw new Error(`home stream has an unknown shape (${HOME_STREAM_PATH})`);
	return data;
}
