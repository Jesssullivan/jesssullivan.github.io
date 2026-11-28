/**
 * The form a stream item takes on a wide screen (TIN-8657, ruling RM70). A picture sets its own form
 * by its shape and its file, so no item is placed by hand and none is placed by chance.
 */
import { kindsOf, type StreamImage, type StreamItem } from './stream';

/** The narrowest picture that leads a post's pictures. A smaller one is shown at its own size, in a row. */
export const LEAD_MIN = 600;
/** The narrowest photograph that is set as a plate, and the least wide shape of one. */
export const PLATE_MIN = 900;
export const PLATE_SHAPE = 1.2;

/**
 * words: nothing to see. The title on the first line, the excerpt on the second.
 * plate: one of her photographs, wide. It starts on the first line and its title lies on it.
 * beside: a tall or square picture, a drawing, a smaller picture, a video. It starts on the second line, beside its words.
 * small: pictures under `LEAD_MIN` wide. A row of them at their own size, on the second line.
 */
export type Form = 'words' | 'plate' | 'beside' | 'small';

/** The picture that leads: the first one wide enough to carry the item, or the first. */
export function leadOf<T extends Pick<StreamImage, 'width'>>(images: readonly T[]): T | undefined {
	return images.find((image) => image.width >= LEAD_MIN) ?? images[0];
}

/**
 * Her photographs are the pictures the photo gallery holds: the gallery's own rule tells a photograph from a screenshot,
 * a drawing or a picture from elsewhere, and an item that holds a set of photographs has them from there.
 * A PNG is a drawing or a screenshot whatever holds it. No type is laid on any of those.
 */
const isPhotograph = (item: Pick<StreamItem, 'kind' | 'holds'>, src: string) => kindsOf(item).includes('photos') && /\.(?:jpe?g|webp|avif)$/i.test(src);

export function formOf(item: Pick<StreamItem, 'kind' | 'holds' | 'media'>): Form {
	const images = item.media.filter((media): media is StreamImage => media.type === 'image');
	const lead = leadOf(images);
	if (!lead) return item.media.some((media) => media.type === 'youtube') ? 'beside' : 'words';
	if (lead.width < LEAD_MIN) return 'small';
	return isPhotograph(item, lead.src) && lead.width >= PLATE_MIN && lead.width / lead.height >= PLATE_SHAPE ? 'plate' : 'beside';
}

/**
 * The row under a lead: every other picture at one height, each as wide as its shape asks.
 * The height is the one at which the row is as wide as the lead, and never more than the shortest file in it.
 */
export function rowOf(rest: readonly Pick<StreamImage, 'width' | 'height'>[]): { sum: number; cap: number } | null {
	if (!rest.length) return null;
	return { sum: rest.reduce((sum, image) => sum + image.width / image.height, 0), cap: Math.min(...rest.map((image) => image.height)) };
}

/**
 * How a post's videos stand: in rows as even as they go, the fuller rows last, so the first posters are the larger ones.
 * Five on a wide screen are two and three. Five on a phone are one, two and two.
 */
export function filmRows(count: number, across: number): number[] {
	if (count <= 0) return [];
	const rows = Math.ceil(count / across);
	const base = Math.floor(count / rows);
	const fuller = count % rows;
	return Array.from({ length: rows }, (_, row) => (row < rows - fuller ? base : base + 1));
}

/** The room a row of posters has for each, as a share of the whole: one over how many stand in its row. */
export function filmShares(count: number, across: number): number[] {
	return filmRows(count, across).flatMap((size) => Array.from({ length: size }, () => 1 / size));
}
