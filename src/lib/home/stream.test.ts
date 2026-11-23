import { describe, expect, it } from 'vitest';
import {
	SET_SIZE,
	altIn,
	buildStream,
	dayOf,
	filterItems,
	filterOf,
	headingOf,
	isDated,
	markerFor,
	monthOf,
	offeredFilters,
	ownsImage,
	tipFor,
	type GalleryInput,
	type ImageFacts,
	type PostInput,
	type StreamSources,
} from './stream';
import { buildScenes } from './scenes';

const post = (slug: string, date: string, extra: Partial<PostInput> = {}): PostInput => ({
	slug,
	date,
	title: `Title of ${slug}`,
	description: `About ${slug}.`,
	tags: ['a'],
	minutes: 4,
	body: '',
	...extra,
});

const photo = (file: string, slug: string | null): GalleryInput => ({
	src: `/images/posts/${file}.jpg`,
	webp: `/images/posts/${file}.webp`,
	width: 1200,
	height: 800,
	post_slug: slug,
	post_title: slug ? `Title of ${slug}` : null,
});

// Every image is 1200 by 800 with both smaller formats, except one the file system does not have.
const image: ImageFacts = (src) => (src.includes('missing') ? null : { width: 1200, height: 800, webp: src.replace(/\.\w+$/, '.webp'), avif: src.replace(/\.\w+$/, '.avif') });

function sources(extra: Partial<StreamSources> = {}): StreamSources {
	return {
		posts: [
			post('birds', '2020-05-01', { body: 'Text ![A wood duck](/images/posts/IMG_2.jpg) more ![](/images/posts/IMG_1.jpg)', featureImage: '/images/posts/IMG_1.jpg' }),
			post('own-cover', '2021-03-02', { body: 'See ![The bench](/images/posts/bench.webp).', featureImage: '/images/posts/bench.png' }),
			post('stock-cover', '2022-07-09', { body: 'No image here.', featureImage: '/images/posts/IMG_5415-2.jpg' }),
			post('plain', '2023-01-15'),
			post('same-day-b', '2024-02-02'),
			post('same-day-a', '2024-02-02'),
		],
		gallery: [photo('IMG_1', 'birds'), photo('IMG_2', 'birds'), photo('IMG_9', null), photo('IMG_8', 'not-a-public-post')],
		pulse: [{ id: 'n1', kind: 'note', occurredAt: '2024-02-02T15:04:05.000Z', summary: 'Short', content: 'A note in full.', tags: ['pulse'] }],
		tracks: [{ title: 'Morning Metal', url: 'https://soundcloud.com/jesssullivan/morning-metal', iso: '2021-04-22', note: 'The usual racket...' }],
		videos: [
			{ id: 'dated00001', title: 'Morning Metal 04.23.21', iso: '2021-04-23' },
			{ id: 'undated001', title: 'Drop A for Activities' },
		],
		image,
		poster: (id) => `/images/video/${id}.jpg`,
		...extra,
	};
}

describe('ordering', () => {
	it('runs newest first across every kind', () => {
		const { items } = buildStream(sources());
		const dates = items.map((item) => item.date.slice(0, 10));
		expect(dates).toEqual([...dates].sort().reverse());
		expect(items.map((item) => item.kind)).toEqual(['note', 'article', 'article', 'article', 'article', 'video', 'recording', 'article', 'article', 'photos']);
	});

	it('settles a shared day the same way whatever order the sources arrive in', () => {
		const forward = buildStream(sources());
		const base = sources();
		const backward = buildStream({ ...base, posts: [...base.posts].reverse(), gallery: [...base.gallery].reverse(), videos: [...base.videos].reverse() });
		expect(JSON.stringify(backward)).toBe(JSON.stringify(forward));
		const day = forward.items.filter((item) => item.date.startsWith('2024-02-02')).map((item) => item.id);
		expect(day).toEqual(['pulse:n1', 'post:same-day-a', 'post:same-day-b']);
	});

	it('is deterministic: the same sources give the same bytes, with no clock in them', () => {
		const once = JSON.stringify(buildStream(sources()));
		expect(JSON.stringify(buildStream(sources()))).toBe(once);
		expect(once).not.toMatch(/generatedAt|timestamp|"now"/i);
		expect(once).not.toContain(String(new Date().getFullYear() + 1));
	});

	it('puts the photographs of a post straight after its writing', () => {
		const { items } = buildStream(sources());
		const at = items.findIndex((item) => item.id === 'post:birds');
		expect(items[at + 1].id).toBe('photos:birds');
	});
});

describe('the cover rule', () => {
	it('knows when a post uses its cover in its own text, in any format', () => {
		expect(ownsImage('![x](/images/posts/bench.webp)', '/images/posts/bench.png')).toBe(true);
		expect(ownsImage('<img src="/images/posts/Bench.JPG">', '/images/posts/bench.png')).toBe(true);
		expect(ownsImage('![x](/images/posts/bench-2.jpg)', '/images/posts/bench.png')).toBe(false);
		expect(ownsImage('text only', '/images/posts/bench.png')).toBe(false);
		expect(ownsImage('text', undefined)).toBe(false);
	});

	it('shows a cover only on the post whose text uses that image', () => {
		const { items, leftOut } = buildStream(sources());
		const own = items.find((item) => item.id === 'post:own-cover')!;
		expect(own.media).toEqual([{ type: 'image', src: '/images/posts/bench.png', width: 1200, height: 800, alt: 'The bench', webp: '/images/posts/bench.webp', avif: '/images/posts/bench.avif' }]);
		expect(items.find((item) => item.id === 'post:stock-cover')!.media).toEqual([]);
		expect(items.find((item) => item.id === 'post:plain')!.media).toEqual([]);
		expect(leftOut.coversNotOwn).toBe(1);
	});

	it('does not repeat a photograph on the writing when the post has a photo set', () => {
		const { items } = buildStream(sources());
		expect(items.find((item) => item.id === 'post:birds')!.media).toEqual([]);
		const set = items.find((item) => item.id === 'photos:birds')!;
		// In the order the post shows them, with the alt text the post gives.
		expect(set.media.map((media) => media.src)).toEqual(['/images/posts/IMG_2.jpg', '/images/posts/IMG_1.jpg']);
		expect(set.media[0]).toMatchObject({ alt: 'A wood duck', webp: '/images/posts/IMG_2.webp', width: 1200, height: 800 });
		expect(set.url).toBe('/blog/birds');
		expect(set.date).toBe('2020-05-01');
	});

	it('drops a cover whose file is not on disk instead of guessing a size', () => {
		const base = sources();
		const { items } = buildStream({ ...base, posts: [post('gone', '2025-01-01', { body: '![x](/images/posts/missing.png)', featureImage: '/images/posts/missing.png' })] });
		expect(items.find((item) => item.id === 'post:gone')!.media).toEqual([]);
	});

	it('reads the alt text a post gives an image', () => {
		expect(altIn('![A wood duck](/images/posts/IMG_2.jpg)', '/images/posts/IMG_2.jpg')).toBe('A wood duck');
		expect(altIn('![](/images/posts/IMG_2.jpg)', '/images/posts/IMG_2.jpg')).toBe('');
		expect(altIn('nothing', '/images/posts/IMG_2.jpg')).toBe('');
	});
});

describe('items left out and counted', () => {
	it('leaves out photographs no public post uses, and videos with no date', () => {
		const { items, leftOut, counts } = buildStream(sources());
		expect(leftOut).toEqual({ photographsWithoutPost: 2, videosWithoutDate: 1, coversNotOwn: 1, undated: 0 });
		expect(items.some((item) => item.id.includes('undated001'))).toBe(false);
		expect(counts).toEqual({ note: 1, article: 6, announcement: 0, photos: 1, recording: 1, video: 1 });
		expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(items.length);
	});

	it('leaves out and counts anything with no usable date', () => {
		const base = sources();
		const { items, leftOut } = buildStream({ ...base, posts: [...base.posts, post('no-date', ''), post('bad-date', 'last spring')] });
		expect(leftOut.undated).toBe(2);
		expect(items.some((item) => item.id === 'post:no-date' || item.id === 'post:bad-date')).toBe(false);
		expect(isDated('2026-06-08')).toBe(true);
		expect(isDated('2026-06-08T12:00:00.000Z')).toBe(true);
		expect(isDated('1970')).toBe(false);
	});

	it('keeps five photographs of a long set and counts the rest', () => {
		const many = Array.from({ length: 9 }, (_, index) => photo(`DSC_${index}`, 'plain'));
		const { items } = buildStream({ ...sources(), gallery: many });
		const set = items.find((item) => item.id === 'photos:plain')!;
		expect(set.media).toHaveLength(SET_SIZE);
		expect(set.more).toBe(4);
	});
});

describe('each kind', () => {
	it('carries a recording and a video as players that nothing loads until asked', () => {
		const { items } = buildStream(sources());
		const recording = items.find((item) => item.kind === 'recording')!;
		expect(recording).toMatchObject({ title: 'Morning Metal', summary: 'The usual racket...', url: 'https://soundcloud.com/jesssullivan/morning-metal', source: 'music' });
		expect(recording.media).toEqual([{ type: 'soundcloud', src: 'https://soundcloud.com/jesssullivan/morning-metal' }]);
		const video = items.find((item) => item.kind === 'video')!;
		expect(video.media[0]).toMatchObject({ type: 'youtube', src: 'dated00001', poster: { src: '/images/video/dated00001.jpg', width: 1200, height: 800 } });
		expect(video.date).toBe('2021-04-23');
	});

	it('carries a note with its full text, and a bird sighting with the bird as its title', () => {
		const { items } = buildStream({
			...sources(),
			pulse: [
				{ id: 'n1', kind: 'note', occurredAt: '2024-02-02T15:04:05.000Z', summary: 'Short', content: 'A note in full.', tags: [] },
				{ id: 'b1', kind: 'bird_sighting', occurredAt: '2024-02-03T08:00:00.000Z', summary: 'Two at the feeder.', content: '', tags: ['birds'], birdSighting: { commonName: 'Pine Siskin', scientificName: 'Spinus pinus', count: 2, placeLabel: 'Yard' } },
			],
		});
		expect(items.find((item) => item.id === 'pulse:n1')).toMatchObject({ kind: 'note', title: '', summary: 'A note in full.', source: 'pulse' });
		expect(items.find((item) => item.id === 'pulse:b1')).toMatchObject({ kind: 'note', title: 'Pine Siskin', summary: 'Two at the feeder.' });
	});

	it('gives writing its reading time for the tooltip', () => {
		const { items } = buildStream(sources());
		expect(tipFor(items.find((item) => item.id === 'post:plain')!)).toBe('Jan 15, 2023 · 4 min read');
		expect(tipFor(items.find((item) => item.kind === 'recording')!)).toBe('Apr 22, 2021');
	});
});

describe('items from the publishing hub join through the same type', () => {
	it('adds a hub item, replaces a local one with the same id, and honours a tombstone', () => {
		const { items, counts } = buildStream({
			...sources(),
			hub: [
				{ id: 'hub:announce-1', kind: 'announcement', date: '2026-12-11', title: 'The hub is live', summary: '', url: '/blog/the-hub-is-live', media: [], tags: [] },
				{ id: 'post:plain', kind: 'article', date: '2023-01-16', title: 'Plain, from the hub', summary: 'Edited.', url: '/blog/plain', media: [], tags: [] },
				{ id: 'post:stock-cover', tombstone: true },
			],
		});
		expect(items[0]).toMatchObject({ id: 'hub:announce-1', kind: 'announcement', source: 'hub' });
		expect(items[0]).not.toHaveProperty('tombstone');
		expect(items.filter((item) => item.id === 'post:plain')).toEqual([expect.objectContaining({ title: 'Plain, from the hub', source: 'hub', date: '2023-01-16' })]);
		expect(items.some((item) => item.id === 'post:stock-cover')).toBe(false);
		expect(counts.announcement).toBe(1);
	});
});

describe('the heading', () => {
	it('shows the newest writing with its own image and the newest photographs until the hub marks something', () => {
		const stream = buildStream(sources());
		expect(stream.heading).toEqual(['post:own-cover', 'photos:birds']);
		const scenes = buildScenes(stream);
		expect(scenes.map((scene) => scene.type)).toEqual(['sky', 'heron', 'placed', 'placed']);
		expect(scenes[2]).toMatchObject({ id: 'post:own-cover', image: { src: '/images/posts/bench.png' } });
	});

	it('shows what the hub marks for the heading, with no code change', () => {
		const stream = buildStream({
			...sources(),
			hub: [{ id: 'hub:announce-1', kind: 'announcement', date: '2026-12-11', title: 'The hub is live', summary: 'It publishes here first.', url: '/blog/the-hub-is-live', media: [{ type: 'image', src: '/images/posts/hub.jpg', width: 1200, height: 800, alt: '' }], tags: [], heading: true }],
		});
		expect(stream.heading).toEqual(['hub:announce-1']);
		expect(headingOf(stream.items)).toEqual(['hub:announce-1']);
		const scenes = buildScenes(stream);
		expect(scenes.map((scene) => scene.id)).toEqual(['sky', 'heron', 'hub:announce-1']);
	});

	it('always opens on the sky, then the heron, even with no stream yet', () => {
		expect(buildScenes(null).map((scene) => scene.id)).toEqual(['sky', 'heron']);
	});
});

describe('filters and markers', () => {
	it('offers a filter only for a kind the stream has', () => {
		const { counts } = buildStream({ ...sources(), pulse: [] });
		expect(offeredFilters(counts).map((filter) => filter.label)).toEqual(['All', 'Writing', 'Photos', 'Recordings', 'Video']);
		expect(offeredFilters(buildStream(sources()).counts).map((filter) => filter.label)).toEqual(['All', 'Notes', 'Writing', 'Photos', 'Recordings', 'Video']);
	});

	it('filters by kind and falls back to All for an unknown value', () => {
		const { items } = buildStream(sources());
		expect(filterItems(items, 'photos').map((item) => item.kind)).toEqual(['photos']);
		expect(filterItems(items, 'writing').every((item) => item.kind === 'article')).toBe(true);
		expect(filterItems(items, 'all')).toHaveLength(items.length);
		expect(filterOf('photos')).toBe('photos');
		expect(filterOf('nonsense')).toBe('all');
		expect(filterOf(null)).toBe('all');
	});

	it('marks the month only where it changes', () => {
		const { items } = buildStream(sources());
		const markers = items.map((_, index) => markerFor(items, index));
		expect(markers[0]).toBe('February 2024');
		expect(markers[1]).toBeNull();
		expect(markers[2]).toBeNull();
		expect(markers[3]).toBe('January 2023');
		expect(monthOf('2026-06-08')).toBe('June 2026');
		expect(dayOf('2026-06-08T23:59:59.000Z')).toBe('Jun 8, 2026');
	});
});
