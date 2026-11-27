/**
 * The scenes of the heading stage (TIN-8657, ruling RM47): the sky of posts,
 * the heron heading, and items placed in the heading. The data file names the
 * placed items, so an item the publishing hub marks for the heading shows here
 * with no code change.
 */
import { holdFor } from './stageClock';
import { headingItem, type StreamFile, type StreamImage, type StreamItem } from './stream';

/** The heron heading, word for word as the site has carried it. */
export const HERON = {
	title: 'Trans Scend Survival',
	name: 'Jess Sullivan',
	/**
	 * The photograph the site's banner was cut from, whole, as the repository holds it: 1200 by 1000 pixels.
	 * The stage never draws it larger than this file (RM93: "true size, feathered"): it stands in the stage at its
	 * own size and all four of its edges fall off into the page. No larger copy is in the repository.
	 *
	 * To go back to full bleed, change this one line to a larger file and its size. The stage reads the size from here:
	 * a file as wide as the window fills the stage, and the feathers at its sides close by themselves.
	 */
	image: { src: '/images/posts/img_8694.jpg', avif: '/images/posts/img_8694.avif', webp: '/images/posts/img_8694.webp', width: 1200, height: 1000, alt: 'Great Blue Heron' },
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
	for (const id of stream.heading) {
		const item = headingItem(stream.items, id);
		// The stage holds a photograph still, so a moving picture is not one it stands on.
		const image = item?.media.find((media): media is StreamImage => media.type === 'image' && !media.motion);
		// A placed item stands on its photograph. One with no image stays in the stream.
		if (item && image) scenes.push({ id: item.id, type: 'placed', hold: holdFor(words(item.title) + words(item.summary)), item, image });
	}
	return scenes;
}
