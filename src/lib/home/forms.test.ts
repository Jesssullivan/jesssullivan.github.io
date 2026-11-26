import { describe, expect, it } from 'vitest';
import { formOf, leadOf, rowOf } from './forms';
import type { StreamMedia } from './stream';

const image = (src: string, width: number, height: number): StreamMedia => ({ type: 'image', src, width, height, alt: '' });
const film: StreamMedia = { type: 'youtube', src: 'abcdefghijk' };
const sound: StreamMedia = { type: 'soundcloud', src: 'https://soundcloud.com/jesssullivan/x' };

describe('the form an item takes on a wide screen', () => {
	it('is words when there is nothing to see, and a recording is heard, not seen', () => {
		expect(formOf({ media: [] })).toBe('words');
		expect(formOf({ media: [sound] })).toBe('words');
	});

	it('is a plate for a wide photograph of 1000 pixels or more', () => {
		expect(formOf({ media: [image('/images/posts/a.jpg', 1200, 800)] })).toBe('plate');
		expect(formOf({ media: [image('/images/posts/a.webp', 1600, 1083)] })).toBe('plate');
		expect(formOf({ media: [image('/images/posts/a.jpg', 1000, 833)] })).toBe('plate');
	});

	it('is beside its words for a tall or square picture, a smaller one, a drawing and a video', () => {
		expect(formOf({ media: [image('/images/posts/tall.jpg', 900, 1200)] })).toBe('beside');
		expect(formOf({ media: [image('/images/posts/square.jpg', 1200, 1116)] })).toBe('beside');
		expect(formOf({ media: [image('/images/posts/smaller.webp', 980, 536)] })).toBe('beside');
		// A PNG is a drawing or a screenshot. No type is laid on it.
		expect(formOf({ media: [image('/images/posts/drawing.png', 1200, 630)] })).toBe('beside');
		expect(formOf({ media: [film, sound] })).toBe('beside');
	});

	it('is small when no picture is 600 pixels wide', () => {
		expect(formOf({ media: [image('/images/posts/a.png', 300, 181), image('/images/posts/b.png', 267, 300)] })).toBe('small');
	});

	it('leads with the first picture wide enough, so a small first one does not decide', () => {
		const media = [image('/images/posts/small.jpg', 300, 225), image('/images/posts/wide.jpg', 1200, 900), image('/images/posts/other.jpg', 300, 150)];
		expect(leadOf(media.filter((entry) => entry.type === 'image'))).toMatchObject({ src: '/images/posts/wide.jpg' });
		expect(formOf({ media })).toBe('plate');
		expect(leadOf([{ width: 300 }, { width: 200 }])).toEqual({ width: 300 });
		expect(leadOf([])).toBeUndefined();
	});

	it('sets the row under a lead to one height, never above the shortest file in it', () => {
		expect(rowOf([])).toBeNull();
		expect(rowOf([{ width: 1200, height: 800 }, { width: 300, height: 150 }])).toEqual({ sum: 3.5, cap: 150 });
	});
});
