/**
 * The form a stream item takes on a wide screen (TIN-8657, ruling RM70). A picture sets its own form
 * by its shape and its file, so no item is placed by hand and none is placed by chance.
 */
import type { StreamImage, StreamItem } from './stream';

/** The narrowest picture that leads a post's pictures. A smaller one is shown at its own size, in a row. */
export const LEAD_MIN = 600;
/** The narrowest photograph that is set as a plate, and the least wide shape of one. */
export const PLATE_MIN = 1000;
export const PLATE_SHAPE = 1.2;

/**
 * words: nothing to see. The title on the first line, the excerpt on the second.
 * plate: a wide photograph. It starts on the first line and its title lies on it.
 * beside: a tall or square picture, a drawing, a smaller picture, a video. It starts on the second line, beside its words.
 * small: pictures under `LEAD_MIN` wide. A row of them at their own size, on the second line.
 */
export type Form = 'words' | 'plate' | 'beside' | 'small';

/** The picture that leads: the first one wide enough to carry the item, or the first. */
export function leadOf<T extends Pick<StreamImage, 'width'>>(images: readonly T[]): T | undefined {
	return images.find((image) => image.width >= LEAD_MIN) ?? images[0];
}

/** A JPEG or a WebP is a photograph. A PNG is a drawing or a screenshot, and no type is laid on one. */
const isPhotograph = (src: string) => /\.(?:jpe?g|webp|avif)$/i.test(src);

export function formOf(item: Pick<StreamItem, 'media'>): Form {
	const images = item.media.filter((media): media is StreamImage => media.type === 'image');
	const lead = leadOf(images);
	if (!lead) return item.media.some((media) => media.type === 'youtube') ? 'beside' : 'words';
	if (lead.width < LEAD_MIN) return 'small';
	return isPhotograph(lead.src) && lead.width >= PLATE_MIN && lead.width / lead.height >= PLATE_SHAPE ? 'plate' : 'beside';
}

/**
 * The row under a lead: every other picture at one height, each as wide as its shape asks.
 * The height is the one at which the row is as wide as the lead, and never more than the shortest file in it.
 */
export function rowOf(rest: readonly Pick<StreamImage, 'width' | 'height'>[]): { sum: number; cap: number } | null {
	if (!rest.length) return null;
	return { sum: rest.reduce((sum, image) => sum + image.width / image.height, 0), cap: Math.min(...rest.map((image) => image.height)) };
}
