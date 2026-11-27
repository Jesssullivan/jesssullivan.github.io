import { describe, expect, it } from 'vitest';
import {
	FILM_SET,
	FOLD_BEFORE,
	SET_SIZE,
	altIn,
	buildStream,
	dayOf,
	filmsIn,
	filterItems,
	filterOf,
	foldStream,
	foldYears,
	headingItem,
	headingOf,
	isDated,
	kindsOf,
	markerFor,
	monthOf,
	offeredFilters,
	ownsImage,
	picturesIn,
	setTotal,
	subjectOf,
	tipFor,
	type GalleryInput,
	type ImageFacts,
	type PostInput,
	type Placed,
	type StreamItem,
	type StreamSources,
} from './stream';
import { buildScenes } from './scenes';
import { SHORT_EXCERPT } from './excerpt';

const post = (slug: string, date: string, extra: Partial<PostInput> = {}): PostInput => ({
	slug,
	date,
	title: `Title of ${slug}`,
	description: `A few words about ${slug}.`,
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
		expect(items.map((item) => item.kind)).toEqual(['note', 'article', 'article', 'article', 'article', 'video', 'recording', 'article', 'article']);
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

	it('shows a post and its photographs as one item, at the post\'s place', () => {
		const { items } = buildStream(sources());
		expect(items.some((item) => item.id === 'photos:birds')).toBe(false);
		expect(items.at(-1)).toMatchObject({ id: 'post:birds', kind: 'article', holds: [{ id: 'photos:birds', kind: 'photos' }] });
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

	it('does not repeat a photograph when the post has a photo set: the set is its pictures', () => {
		const { items } = buildStream(sources());
		const birds = items.find((item) => item.id === 'post:birds')!;
		// In the order the post shows them, with the alt text the post gives. The cover, IMG_1, shows once.
		expect(birds.media.map((media) => media.src)).toEqual(['/images/posts/IMG_2.jpg', '/images/posts/IMG_1.jpg']);
		expect(birds.media[0]).toMatchObject({ alt: 'A wood duck', webp: '/images/posts/IMG_2.webp', width: 1200, height: 800 });
		expect(birds.url).toBe('/blog/birds');
		expect(birds.date).toBe('2020-05-01');
	});

	it('drops a cover whose file is not on disk instead of guessing a size', () => {
		const base = sources();
		const { items } = buildStream({ ...base, posts: [post('gone', '2025-01-01', { body: '![x](/images/posts/missing.png)', featureImage: '/images/posts/missing.png' })] });
		expect(items.find((item) => item.id === 'post:gone')!.media).toEqual([]);
	});

	it('counts a drawing the text shows as SVG for its cover in the format the site serves', () => {
		expect(ownsImage('![flow](/images/posts/flow.svg)', '/images/posts/flow.png')).toBe(true);
		const base = sources();
		const { items, leftOut } = buildStream({ ...base, posts: [post('drawn', '2025-01-01', { body: '![The flow](/images/posts/flow.svg)', featureImage: '/images/posts/flow.png' })] });
		expect(items.find((item) => item.id === 'post:drawn')!.media).toEqual([{ type: 'image', src: '/images/posts/flow.png', width: 1200, height: 800, alt: 'The flow', webp: '/images/posts/flow.webp', avif: '/images/posts/flow.avif' }]);
		expect(leftOut.coversNotOwn).toBe(0);
	});

	it('reads the alt text a post gives an image', () => {
		expect(altIn('![A wood duck](/images/posts/IMG_2.jpg)', '/images/posts/IMG_2.jpg')).toBe('A wood duck');
		expect(altIn('![](/images/posts/IMG_2.jpg)', '/images/posts/IMG_2.jpg')).toBe('');
		expect(altIn('nothing', '/images/posts/IMG_2.jpg')).toBe('');
	});
});

describe('every picture a post shows', () => {
	it('reads Markdown images and image tags in the order of the text, and nothing inside a code block', () => {
		const body = ['![One](/images/posts/one.jpg "a title")', '<img alt="Two" src="/images/posts/two.png" width="300">', '```md', '![Not shown](/images/posts/in-code.jpg)', '```', "<img src='https://example.org/far.jpg'>"].join('\n\n');
		expect(picturesIn(body)).toEqual([
			{ src: '/images/posts/one.jpg', alt: 'One' },
			{ src: '/images/posts/two.png', alt: 'Two' },
			{ src: 'https://example.org/far.jpg', alt: '' },
		]);
	});

	it('gives a post the pictures its own text shows, each once, in its order, though its cover is a shared one', () => {
		const base = sources();
		const body = '![A](/images/posts/a.jpg) words ![B](/images/posts/b.jpg) and again ![A](/images/posts/a.jpg)';
		const { items, leftOut } = buildStream({ ...base, posts: [post('shown', '2025-01-01', { body, featureImage: '/images/posts/IMG_5415-2.jpg' })] });
		expect(items.find((item) => item.id === 'post:shown')!.media.map((media) => media.src)).toEqual(['/images/posts/a.jpg', '/images/posts/b.jpg']);
		// The shared cover is still not shown, and still counted.
		expect(leftOut.coversNotOwn).toBe(1);
	});

	it('leaves out a moving picture that has no still and a picture another site holds, and counts each', () => {
		const base = sources();
		const body = '![](/images/posts/loop.gif) ![](https://example.org/far.jpg) ![Still](/images/posts/still.jpg) ![](/images/posts/missing.jpg)';
		const { items, leftOut } = buildStream({ ...base, posts: [post('mixed', '2025-01-01', { body })] });
		expect(items.find((item) => item.id === 'post:mixed')!.media.map((media) => media.src)).toEqual(['/images/posts/still.jpg']);
		expect(leftOut).toMatchObject({ picturesMoving: 1, picturesElsewhere: 1 });
	});

	it('shows a moving picture that has a still, with the still and the moving file it plays', () => {
		const motion = { still: '/images/home/loop-still.webp', moving: '/images/home/loop-moving.webp' };
		const facts: ImageFacts = (src) => (src.endsWith('.gif') ? { width: 540, height: 289, motion } : image(src));
		const body = 'Words. ![Not dead yet](/images/posts/loop.gif)';
		const stream = buildStream({ ...sources(), image: facts, posts: [post('moving', '2026-06-09', { body })] });
		expect(stream.items.find((item) => item.id === 'post:moving')!.media).toEqual([{ type: 'image', src: '/images/posts/loop.gif', width: 540, height: 289, alt: 'Not dead yet', motion }]);
		expect(stream.leftOut.picturesMoving).toBe(0);
		// The stage holds photographs still, so a moving picture is never a scene of the heading.
		expect(stream.heading).not.toContain('post:moving');
		expect(buildScenes({ items: stream.items, heading: ['post:moving'] }).map((scene) => scene.id)).toEqual(['sky', 'heron']);
	});

	it('shows a picture file with the one post whose text shows it', () => {
		// RM96: the printer photograph belongs to one post, and the two others no longer show it. A cover alone does not count as showing.
		const posts = [
			post('printers', '2020-08-23', { body: '![drawing](/images/posts/unnamed.jpg) ![drawing](/images/posts/unnamed-1.jpg)' }),
			post('snow', '2017-04-02', { body: 'Tracks in the snow.', featureImage: '/images/posts/unnamed.jpg' }),
		];
		const { items, leftOut } = buildStream({ ...sources(), posts });
		expect(items.find((item) => item.id === 'post:printers')!.media.map((media) => media.src)).toEqual(['/images/posts/unnamed.jpg', '/images/posts/unnamed-1.jpg']);
		expect(items.find((item) => item.id === 'post:snow')!.media).toEqual([]);
		expect(leftOut.picturesShared).toBe(0);
	});

	it('shows a picture file with no post when the text of more than one post shows it', () => {
		const base = sources();
		// The old export gave three uploads one name. The one file left is not the picture of all three posts.
		const posts = [
			post('printers', '2020-08-23', { body: '![](/images/posts/unnamed.jpg) ![](/images/posts/unnamed-1.jpg)' }),
			post('snow', '2017-04-02', { body: '![](/images/posts/unnamed.jpg)', featureImage: '/images/posts/unnamed.jpg' }),
		];
		const { items, leftOut } = buildStream({ ...base, posts, gallery: [photo('unnamed', 'snow')] });
		expect(items.find((item) => item.id === 'post:printers')!.media.map((media) => media.src)).toEqual(['/images/posts/unnamed-1.jpg']);
		expect(items.find((item) => item.id === 'post:snow')!.media).toEqual([]);
		expect(leftOut.picturesShared).toBe(1);
	});

	it('shows five pictures at most, and a set of photographs of the same files adds none', () => {
		const base = sources();
		const names = ['IMG_1', 'IMG_2', 'IMG_3', 'IMG_4', 'IMG_5', 'IMG_6', 'IMG_7'];
		const body = names.map((name) => `![](/images/posts/${name}.jpg)`).join(' ');
		const { items } = buildStream({ ...base, posts: [post('many', '2025-01-01', { body })], gallery: names.map((name) => photo(name, 'many')) });
		const many = items.find((item) => item.id === 'post:many')!;
		expect(many.media.map((media) => media.src)).toEqual(names.slice(0, SET_SIZE).map((name) => `/images/posts/${name}.jpg`));
		expect(many.more).toBe(2);
		expect(setTotal(many)).toBe(7);
		// Without a set of photographs the post shows its first five and counts nothing.
		const plain = buildStream({ ...base, posts: [post('many', '2025-01-01', { body })], gallery: [] }).items.find((item) => item.id === 'post:many')!;
		expect(plain.media).toHaveLength(SET_SIZE);
		expect(plain.more).toBeUndefined();
	});
});

describe('items left out and counted', () => {
	it('leaves out photographs no public post uses, and videos with no date', () => {
		const { items, leftOut, counts } = buildStream(sources());
		expect(leftOut).toEqual({ photographsWithoutPost: 2, videosWithoutDate: 1, coversNotOwn: 1, picturesMoving: 0, picturesElsewhere: 0, picturesShared: 0, videosWithoutPoster: 0, undated: 0 });
		expect(items.some((item) => item.id.includes('undated001'))).toBe(false);
		expect(counts).toEqual({ note: 1, article: 6, announcement: 0, photos: 1, recording: 1, video: 1 });
		// One post holds its photographs, so it is counted under both kinds: nine items, ten in the counts.
		expect(items).toHaveLength(9);
		expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(10);
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
		const set = items.find((item) => item.id === 'post:plain')!;
		expect(set.media).toHaveLength(SET_SIZE);
		expect(set.more).toBe(4);
	});

	it('counts a set of photographs only when the post holds more than the set shows', () => {
		const set = (shown: number, slug: string) => buildStream({ ...sources(), gallery: Array.from({ length: shown }, (_, index) => photo(`DSC_${index}`, slug)) }).items.find((item) => item.id === `post:${slug}`)!;
		// Nine in the post, five on screen: the count says there are more.
		expect(setTotal(set(9, 'plain'))).toBe(9);
		// Every photograph is on screen: the reader sees how many, so nothing is said.
		expect(setTotal(set(SET_SIZE, 'plain'))).toBe(0);
		expect(setTotal(set(3, 'plain'))).toBe(0);
		expect(setTotal(set(1, 'plain'))).toBe(0);
		expect(setTotal({ media: [], more: 0 })).toBe(0);
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

describe('the videos a post shows', () => {
	const list = ['Words first.', '', '  * [handling clients, 2/17/21](https://www.youtube.com/watch?v=aaaaaaaaaaa)', '  * [_Jest_ x Puppeteer](https://youtu.be/bbbbbbbbbbb)', '  * [web tools 12/1/20](https://www.youtube.com/watch?v=ccccccccccc&feature=youtu.be)'].join('\n');

	it('reads a video the post gives a line of its own, in the order of the text, with the words the post gives it', () => {
		expect(filmsIn(list)).toEqual([
			{ id: 'aaaaaaaaaaa', title: 'handling clients, 2/17/21' },
			{ id: 'bbbbbbbbbbb', title: 'Jest x Puppeteer' },
			{ id: 'ccccccccccc', title: 'web tools 12/1/20' },
		]);
		expect(filmsIn('[A film](https://youtu.be/ddddddddddd)\n\n<iframe src="https://www.youtube-nocookie.com/embed/eeeeeeeeeee?rel=0" title="Framed"></iframe>\n\n[A film](https://youtu.be/ddddddddddd)')).toEqual([
			{ id: 'ddddddddddd', title: 'A film' },
			{ id: 'eeeeeeeeeee', title: 'Framed' },
		]);
	});

	it('does not read a video the post only points at from inside a sentence, a playlist, or a line of code', () => {
		expect(filmsIn('To [some french dudes doing unicycle ballet](https://youtu.be/fffffffffff) and on.')).toEqual([]);
		expect(filmsIn('- [Firestarter mixtape](https://youtu.be/ggggggggggg?si=x) — a classic!')).toEqual([]);
		expect(filmsIn('[in this playlist](https://www.youtube.com/playlist?list=PL6y8N_vP4OopcvDfwcEyvx1Nz4MVSZK7R)')).toEqual([]);
		expect(filmsIn('```\n[x](https://youtu.be/hhhhhhhhhhh)\n```')).toEqual([]);
	});

	it('shows a video only by a poster the repository holds, and counts the ones with none', () => {
		const held = new Set(['aaaaaaaaaaa', 'ccccccccccc']);
		const stream = buildStream({ ...sources(), posts: [post('demos', '2021-02-17', { body: list })], poster: (id) => (held.has(id) ? `asset:video/${id}.jpg` : null) });
		const demos = stream.items.find((item) => item.id === 'post:demos')!;
		expect(demos.media).toEqual([
			{ type: 'youtube', src: 'aaaaaaaaaaa', title: 'handling clients, 2/17/21', poster: expect.objectContaining({ src: 'asset:video/aaaaaaaaaaa.jpg', width: 1200, height: 800 }) },
			{ type: 'youtube', src: 'ccccccccccc', title: 'web tools 12/1/20', poster: expect.objectContaining({ src: 'asset:video/ccccccccccc.jpg' }) },
		]);
		expect(stream.leftOut.videosWithoutPoster).toBe(1);
		// The post is writing that shows video, so it stands under both.
		expect(kindsOf(demos)).toEqual(['article', 'video']);
		expect(filterItems(stream.items, 'video').map((item) => item.id)).toContain('post:demos');
		expect(stream.counts.video).toBe(stream.items.filter((item) => kindsOf(item).includes('video')).length);
	});

	it('shows six at most, and leaves a video the Music page lists to its own item', () => {
		const ids = ['k1111111111', 'k2222222222', 'k3333333333', 'k4444444444', 'k5555555555', 'k6666666666', 'k7777777777'];
		const body = [...ids, 'dated00001'].map((id) => `[film](https://youtu.be/${id})`).join('\n\n');
		const { items } = buildStream({ ...sources(), posts: [post('reel', '2025-01-01', { body })] });
		const reel = items.find((item) => item.id === 'post:reel')!;
		expect(reel.media.map((media) => media.src)).toEqual(ids.slice(0, FILM_SET));
		expect(items.filter((item) => item.media.some((media) => media.src === 'dated00001')).map((item) => item.id)).toEqual(['video:dated00001']);
	});
});

describe('a post that is words alone takes a short excerpt', () => {
	const first = 'I slipped and slid my way into the park on Saturday at about four.';
	const long = `${first} About seven inches of snow had appeared on the ground over the last day, which stifled any spring-like activity for the second time. I heard some confused titmice.`;

	it('keeps her first sentences, fewer of them, and ends at a sentence end', () => {
		const { items } = buildStream({ ...sources(), posts: [post('words', '2025-01-01', { description: long }), post('seen', '2025-01-02', { description: long, body: '![](/images/posts/a.jpg)' })] });
		const words = items.find((item) => item.id === 'post:words')!;
		expect(words.summary).toBe(first);
		expect(words.summary.length).toBeLessThanOrEqual(SHORT_EXCERPT.max);
		// A post with a picture keeps the longer run beside it.
		expect(items.find((item) => item.id === 'post:seen')!.summary.length).toBeGreaterThan(SHORT_EXCERPT.max);
	});

	it('is absent when her first sentence is longer than a short excerpt may be: nothing cuts a sentence', () => {
		const sentence = `${'A very long first sentence that goes on and on, '.repeat(5)}and then it ends.`;
		expect(sentence.length).toBeGreaterThan(SHORT_EXCERPT.longest);
		const { items } = buildStream({ ...sources(), posts: [post('words', '2025-01-01', { description: `${sentence} A short one.` })] });
		expect(items.find((item) => item.id === 'post:words')!.summary).toBe('');
	});
});

describe('the older years fold', () => {
	const years = () => buildStream({ ...sources(), posts: [post('new', '2021-03-02'), post('edge', '2020-01-01'), post('a19', '2019-12-31'), post('b19', '2019-03-01', { body: '![](/images/posts/IMG_1.jpg)' }), post('a17', '2017-05-05')], gallery: [photo('IMG_1', 'b19')], pulse: [], tracks: [], videos: [] }).items;

	it('keeps the years from 2020 on as they are, and gives each older year one line with its items, newest year first', () => {
		expect(FOLD_BEFORE).toBe(2020);
		const { open, years: folds } = foldYears(years());
		expect(open.map((item) => item.id)).toEqual(['post:new', 'post:edge']);
		expect(folds.map((fold) => [fold.year, fold.items.map((item) => item.id)])).toEqual([
			['2019', ['post:a19', 'post:b19']],
			['2017', ['post:a17']],
		]);
	});

	it('counts and shows only what a filter leaves, and a year with nothing is absent', () => {
		const { open, years: folds } = foldYears(filterItems(years(), 'photos'));
		expect(open).toEqual([]);
		expect(folds.map((fold) => [fold.year, fold.items.length])).toEqual([['2019', 1]]);
	});

	it('marks a month by its name alone inside a year, which names itself', () => {
		const [fold] = foldYears(years()).years;
		expect(fold.items.map((_, index) => markerFor(fold.items, index, true))).toEqual(['December', 'March']);
		expect(markerFor(fold.items, 0)).toBe('December 2019');
	});
});

describe('the heading', () => {
	it('shows the newest writing with its own image and the newest photographs until the hub marks something', () => {
		const stream = buildStream(sources());
		expect(stream.heading).toEqual(['post:own-cover', 'photos:birds']);
		const scenes = buildScenes(stream);
		expect(scenes.map((scene) => scene.type)).toEqual(['sky', 'heron', 'placed', 'placed']);
		expect(scenes[2]).toMatchObject({ id: 'post:own-cover', image: { src: '/images/posts/bench.png' } });
		// The photographs are held by their post. The scene keeps their id and the post's title, with no summary.
		expect(scenes[3]).toMatchObject({ id: 'photos:birds', item: { title: 'Title of birds', summary: '', url: '/blog/birds' }, image: { src: '/images/posts/IMG_2.jpg' } });
		expect(headingItem(stream.items, 'post:own-cover')?.summary).toBe('A few words about own-cover.');
		expect(headingItem(stream.items, 'photos:nothing')).toBeUndefined();
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
		// A post that holds its photographs shows under Photos and under Writing.
		expect(filterItems(items, 'photos').map((item) => item.id)).toEqual(['post:birds']);
		expect(filterItems(items, 'writing').map((item) => item.id)).toContain('post:birds');
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

describe('folding: things with one subject show as one item', () => {
	// Her own titles: the post, its recording and its video.
	const POST = 'Morning Metal 4.22.21 \u201cSleepish\u201d';
	const metal = (extra: Partial<StreamSources> = {}): StreamSources => ({
		...sources(),
		posts: [post('morning-metal-4-22-21', '2021-04-23', { title: POST, description: 'The usual racket.' }), post('plain', '2023-01-15')],
		gallery: [],
		pulse: [],
		tracks: [{ title: 'Morning Metal 4.22.21 "Sleepish"', url: 'https://soundcloud.com/jesssullivan/morning-metal-42221', iso: '2021-04-22', note: 'The usual racket...' }],
		videos: [{ id: 'JVusudpKTF8', title: 'Morning Metal 04.23.21', iso: '2021-04-23' }],
		...extra,
	});
	const ids = (stream: { items: StreamItem[] }) => stream.items.map((item) => item.id);

	it('reads the words and the day a title states', () => {
		expect(subjectOf('Morning Metal 04.23.21')).toEqual({ name: 'morning metal', day: '2021-04-23' });
		expect(subjectOf(POST)).toEqual({ name: 'morning metal', day: '2021-04-22' });
		expect(subjectOf('Morning Metal 10/28/20')).toEqual({ name: 'morning metal', day: '2020-10-28' });
		expect(subjectOf('Shortest Morning Metal 7 8 20')).toEqual({ name: 'shortest morning metal', day: '2020-07-08' });
		expect(subjectOf('Evening Metal 9-14-2020')).toEqual({ name: 'evening metal', day: '2020-09-14' });
		// No day, a day that is no day, a day with nothing before it, and two different separators.
		expect(subjectOf('Morning Metal')).toBeNull();
		expect(subjectOf('Drop A for Activities')).toBeNull();
		expect(subjectOf('Morning Metal 13.40.21')).toBeNull();
		expect(subjectOf('4.22.21')).toBeNull();
		expect(subjectOf('Morning Metal 4.22/21')).toBeNull();
		expect(subjectOf('Version 1.2.3456 of a thing')).toBeNull();
	});

	it('folds a post, its recording and its video into the post, and keeps what each calls itself', () => {
		const stream = buildStream(metal());
		expect(ids(stream)).toEqual(['post:plain', 'post:morning-metal-4-22-21']);
		const item = stream.items[1];
		expect(item).toMatchObject({ kind: 'article', title: POST, summary: 'The usual racket.', url: '/blog/morning-metal-4-22-21', date: '2021-04-23' });
		expect(item.holds).toEqual([
			{ id: 'track:morning-metal-42221', kind: 'recording' },
			{ id: 'video:JVusudpKTF8', kind: 'video' },
		]);
		// The video before the recording, each with its own title, day, address and note.
		expect(item.media).toEqual([
			{ type: 'youtube', src: 'JVusudpKTF8', poster: expect.objectContaining({ src: '/images/video/JVusudpKTF8.jpg' }), title: 'Morning Metal 04.23.21', date: '2021-04-23', url: 'https://www.youtube.com/watch?v=JVusudpKTF8' },
			{ type: 'soundcloud', src: 'https://soundcloud.com/jesssullivan/morning-metal-42221', title: 'Morning Metal 4.22.21 "Sleepish"', date: '2021-04-22', url: 'https://soundcloud.com/jesssullivan/morning-metal-42221', note: 'The usual racket...' },
		]);
		expect(kindsOf(item)).toEqual(['article', 'recording', 'video']);
	});

	it('counts a folded item under every kind it holds, and shows it under each filter', () => {
		const { items, counts } = buildStream(metal());
		expect(counts).toEqual({ note: 0, article: 2, announcement: 0, photos: 0, recording: 1, video: 1 });
		for (const filter of ['writing', 'recordings', 'video'] as const) expect(filterItems(items, filter).map((item) => item.id)).toContain('post:morning-metal-4-22-21');
		expect(filterItems(items, 'recordings')).toHaveLength(1);
		expect(filterItems(items, 'photos')).toHaveLength(0);
		expect(offeredFilters(counts).map((filter) => filter.label)).toEqual(['All', 'Writing', 'Recordings', 'Video']);
	});

	it('does not join the same title on a different date', () => {
		// The same words and another year in the title.
		const year = buildStream(metal({ tracks: [{ title: 'Morning Metal 4.22.20', url: 'https://soundcloud.com/jesssullivan/morning-metal-42220', iso: '2020-04-22', note: '' }], videos: [] }));
		expect(ids(year)).toEqual(['post:plain', 'post:morning-metal-4-22-21', 'track:morning-metal-42220']);
		// The very same title, on a recording whose own date is another day.
		const other = buildStream(metal({ tracks: [{ title: 'Morning Metal 4.22.21 "Sleepish"', url: 'https://soundcloud.com/jesssullivan/morning-metal-42221', iso: '2021-06-01', note: '' }], videos: [] }));
		expect(ids(other)).toEqual(['post:plain', 'track:morning-metal-42221', 'post:morning-metal-4-22-21']);
		expect(other.items.every((item) => !item.holds)).toBe(true);
		// A title with no day, the same on a post and a recording of one date: a shared name alone joins nothing.
		const bare = buildStream(metal({ posts: [post('evening-metal', '2020-09-14', { title: 'Evening Metal' })], tracks: [{ title: 'Evening Metal', url: 'https://soundcloud.com/jesssullivan/evening-metal', iso: '2020-09-14', note: '' }], videos: [] }));
		expect(ids(bare)).toEqual(['post:evening-metal', 'track:evening-metal']);
	});

	it('does not join a video whose title only contains a post\'s title', () => {
		const stream = buildStream(metal({ videos: [{ id: 'short00001', title: 'Shortest Morning Metal 4.22.21', iso: '2021-04-22' }, { id: 'again00001', title: 'Morning Metal Again 04.23.21', iso: '2021-04-23' }] }));
		expect(ids(stream)).toEqual(['post:plain', 'post:morning-metal-4-22-21', 'video:again00001', 'video:short00001']);
		expect(stream.items[1].holds).toEqual([{ id: 'track:morning-metal-42221', kind: 'recording' }]);
		expect(stream.counts.video).toBe(2);
	});

	it('joins neither post when two answer', () => {
		const stream = buildStream(metal({ posts: [post('morning-metal-4-22-21', '2021-04-23', { title: POST }), post('morning-metal-again', '2021-04-22', { title: 'Morning Metal 4.22.21' })], videos: [] }));
		expect(stream.items.every((item) => !item.holds)).toBe(true);
		expect(stream.items).toHaveLength(3);
	});

	it('joins two videos of one title and one day that no post answers, and nothing else', () => {
		const stream = buildStream(
			metal({
				posts: [],
				tracks: [],
				videos: [
					{ id: 'nVkjCMmpUII', title: 'Shortest Morning Metal 7 8 20', iso: '2020-07-08' },
					{ id: 'jrxJHwmtwak', title: 'Shortest Morning Metal 7 8 20', iso: '2020-07-08' },
					{ id: 'zCrrzdaBCsw', title: 'Morning Metal 10/28/20', iso: '2020-10-28' },
					{ id: 'other00001', title: 'Shortest Morning Metal 7 9 20', iso: '2020-07-09' },
				],
			}),
		);
		expect(ids(stream)).toEqual(['video:zCrrzdaBCsw', 'video:other00001', 'video:jrxJHwmtwak']);
		const pair = stream.items[2];
		expect(pair.holds).toEqual([{ id: 'video:nVkjCMmpUII', kind: 'video' }]);
		expect(pair.media.map((media) => media.src)).toEqual(['jrxJHwmtwak', 'nVkjCMmpUII']);
		expect(stream.counts.video).toBe(3);
	});

	it('gives the same bytes whatever order the sources arrive in', () => {
		const base = metal({ gallery: [photo('IMG_1', 'plain'), photo('IMG_2', 'plain')] });
		const forward = buildStream(base);
		const backward = buildStream({ ...base, posts: [...base.posts].reverse(), gallery: [...base.gallery].reverse() });
		expect(JSON.stringify(backward)).toBe(JSON.stringify(forward));
		expect(forward.items[0].holds).toEqual([{ id: 'photos:plain', kind: 'photos' }]);
	});

	it('leaves a list with nothing to join as it is', () => {
		const placed: Placed[] = buildStream(metal({ tracks: [], videos: [] })).items.map((item) => ({ item, anchor: item.id }));
		expect(foldStream(placed)).toEqual(placed);
	});
});
