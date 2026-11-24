/**
 * Files the home page brings with it (TIN-8657): the heron photograph and the video posters.
 * The build gives each a content hash in its name, so a browser may keep it for good.
 * The stream and the scenes name one as `asset:<path under src/lib/assets/home>`.
 * Only components import this file, so a unit test never needs the pictures on disk.
 */
const files = import.meta.glob('$lib/assets/home/**/*.{avif,webp,jpg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const MARK = '/assets/home/';
const built = new Map(Object.entries(files).map(([path, url]) => [path.slice(path.indexOf(MARK) + MARK.length), url]));

export const ASSET_PREFIX = 'asset:';

/** The address of a picture: the built one for an `asset:` name, the name itself for any other. */
export function assetUrl(src: string): string;
export function assetUrl(src: string | undefined): string | undefined;
export function assetUrl(src: string | undefined): string | undefined {
	if (!src?.startsWith(ASSET_PREFIX)) return src;
	return built.get(src.slice(ASSET_PREFIX.length));
}
