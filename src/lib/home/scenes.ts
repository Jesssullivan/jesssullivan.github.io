/**
 * The scenes of the heading stage (TIN-8657, ruling RM47): the sky of posts,
 * the heron heading, and items placed in the heading. The data file names the
 * placed items, so an item the publishing hub marks for the heading shows here
 * with no code change.
 */
import { holdFor } from './stageClock';
import type { StreamFile, StreamImage, StreamItem } from './stream';

/** The heron heading, word for word as the site has carried it. */
export const HERON = {
	title: 'Trans Scend Survival',
	name: 'Jess Sullivan',
	/**
	 * The only copy of this photograph is 672 by 219 pixels. It is served at that size and never as an
	 * enlarged file. The AVIF and the WebP are made from the PNG and carry a content hash in their built names.
	 */
	image: { src: '/images/header.png', avif: 'asset:heron-672.avif', webp: 'asset:heron-672.webp', width: 672, height: 219, alt: 'Great Blue Heron' },
	definitions: [
		{ term: 'Trans:', text: 'Latin prefix implying “across” or “Beyond”, often used in gender nonconforming situations' },
		{ term: 'Scend:', text: 'Archaic word describing a strong “surge” or “wave”, originating with 15th century english sailors' },
		{ term: 'Survival:', text: '15th century english compound word describing an existence only worth transcending' },
	],
} as const;

export type StageScene =
	| { id: 'sky'; type: 'sky'; hold: number }
	| { id: 'heron'; type: 'heron'; hold: number }
	| { id: string; type: 'placed'; hold: number; item: StreamItem; image: StreamImage };

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The sky holds the shortest time a scene may, so a first visit sees the stage move within its first ten seconds. */
const SKY_WORDS = 0;

export function buildScenes(stream: Pick<StreamFile, 'items' | 'heading'> | null): StageScene[] {
	const heronWords = words(HERON.title) + words(HERON.name) + HERON.definitions.reduce((sum, entry) => sum + words(entry.term) + words(entry.text), 0);
	const scenes: StageScene[] = [
		{ id: 'sky', type: 'sky', hold: holdFor(SKY_WORDS) },
		{ id: 'heron', type: 'heron', hold: holdFor(heronWords) },
	];
	if (!stream) return scenes;
	const byId = new Map(stream.items.map((item) => [item.id, item]));
	for (const id of stream.heading) {
		const item = byId.get(id);
		const image = item?.media.find((media): media is StreamImage => media.type === 'image');
		// A placed item stands on its photograph. One with no image stays in the stream.
		if (item && image) scenes.push({ id: item.id, type: 'placed', hold: holdFor(words(item.title) + words(item.summary)), item, image });
	}
	return scenes;
}
