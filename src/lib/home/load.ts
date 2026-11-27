import { browser } from '$app/environment';
// The build puts a content hash in the name of this file, so a browser may keep it until the stream changes.
import streamUrl from '$lib/data/home-stream.v1.json?url';
import { withRetries } from './retry';
import type { StreamFile } from './stream';

/** The one data file of the home stream, written by scripts/generate-home-stream.mts (TIN-8657). */
export const HOME_STREAM_URL: string = streamUrl;

export type StreamFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * One same-origin read of a committed file. Nothing here asks another host for anything.
 * A prerender reads the file from the build itself. A browser asks for it by its hashed name.
 * A browser asks up to three times: on a build with the stage on, this read is part of the page's
 * first load, and a failure there takes the prerendered page away and shows the error page.
 */
export async function loadHomeStream(fetchFn: StreamFetch): Promise<StreamFile> {
	let data: StreamFile;
	if (browser) {
		data = await withRetries(async () => {
			const response = await fetchFn(HOME_STREAM_URL);
			if (!response.ok) throw new Error(`home stream fetch failed: ${response.status} (${HOME_STREAM_URL})`);
			return (await response.json()) as StreamFile;
		});
	} else {
		data = (await import('$lib/data/home-stream.v1.json')).default as unknown as StreamFile;
	}
	if (data?.version !== 1 || !Array.isArray(data.items) || !Array.isArray(data.heading)) throw new Error(`home stream has an unknown shape (${HOME_STREAM_URL})`);
	return data;
}
