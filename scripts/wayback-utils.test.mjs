import { describe, it, expect } from 'vitest';
import {
	extractFilename,
	buildWaybackUrl,
	normalizeWpImageUrl,
	localImagePath,
	extractImageUrls,
	isExternalWpUrl,
	parseCdxResponse,
} from './wayback-utils.mjs';

describe('extractFilename', () => {
	it('extracts filename from WordPress CDN URL', () => {
		expect(
			extractFilename(
				'https://i1.wp.com/transscendsurvival.org/wp-content/uploads/2018/05/IMG_7092-Edit.jpg?ssl=1'
			)
		).toBe('IMG_7092-Edit.jpg');
	});

	it('strips dimension suffixes', () => {
		expect(
			extractFilename(
				'https://i2.wp.com/transscendsurvival.org/wp-content/uploads/2018/05/IMG_7092-Edit-300x200.jpg?resize=300%2C200&ssl=1'
			)
		).toBe('IMG_7092-Edit.jpg');
	});

	it('strips WordPress edit suffixes', () => {
		expect(
			extractFilename(
				'https://i1.wp.com/transscendsurvival.org/wp-content/uploads/2018/05/IMG_3355-1-e1527804648975.jpg?ssl=1'
			)
		).toBe('IMG_3355-1.jpg');
	});

	it('handles plain filenames in URLs', () => {
		expect(
			extractFilename('https://example.com/images/photo.png')
		).toBe('photo.png');
	});

	it('handles URL-encoded filenames', () => {
		expect(
			extractFilename('https://example.com/images/my%20photo.jpg')
		).toBe('my photo.jpg');
	});
});

describe('buildWaybackUrl', () => {
	it('builds correct Wayback URL with im_ flag', () => {
		const result = buildWaybackUrl(
			'20180601120000',
			'https://transscendsurvival.org/wp-content/uploads/2018/05/IMG_7092-Edit.jpg'
		);
		expect(result).toBe(
			'https://web.archive.org/web/20180601120000im_/https://transscendsurvival.org/wp-content/uploads/2018/05/IMG_7092-Edit.jpg'
		);
	});
});

describe('normalizeWpImageUrl', () => {
	it('strips i0.wp.com CDN wrapper', () => {
		expect(
			normalizeWpImageUrl(
				'https://i0.wp.com/transscendsurvival.org/wp-content/uploads/2020/04/JESSSOES-03.png?resize=676%2C875&ssl=1'
			)
		).toBe('https://transscendsurvival.org/wp-content/uploads/2020/04/JESSSOES-03.png');
	});

	it('strips i1.wp.com CDN wrapper', () => {
		expect(
			normalizeWpImageUrl(
				'https://i1.wp.com/transscendsurvival.org/wp-content/uploads/2017/07/IMG_9803.jpg?resize=150%2C150&ssl=1'
			)
		).toBe('https://transscendsurvival.org/wp-content/uploads/2017/07/IMG_9803.jpg');
	});

	it('strips query params from non-CDN URLs', () => {
		expect(
			normalizeWpImageUrl(
				'https://transscendsurvival.org/wp-content/uploads/2018/05/IMG_7092-Edit.jpg?ssl=1'
			)
		).toBe('https://transscendsurvival.org/wp-content/uploads/2018/05/IMG_7092-Edit.jpg');
	});

	it('returns non-URL strings unchanged', () => {
		expect(normalizeWpImageUrl('not-a-url')).toBe('not-a-url');
	});
});

describe('localImagePath', () => {
	it('returns path under /images/posts/', () => {
		expect(localImagePath('photo.jpg')).toBe('/images/posts/photo.jpg');
	});

	it('deduplicates when filename exists', () => {
		const existing = new Set(['photo.jpg']);
		expect(localImagePath('photo.jpg', existing)).toBe('/images/posts/photo-1.jpg');
	});

	it('increments suffix for multiple collisions', () => {
		const existing = new Set(['photo.jpg', 'photo-1.jpg', 'photo-2.jpg']);
		expect(localImagePath('photo.jpg', existing)).toBe('/images/posts/photo-3.jpg');
	});
});

describe('extractImageUrls', () => {
	it('extracts markdown image references', () => {
		const content = '---\ntitle: Test\n---\n\n![alt text](/images/posts/photo.jpg)\n\nSome text.';
		const images = extractImageUrls(content);
		expect(images).toHaveLength(1);
		expect(images[0]).toEqual({ url: '/images/posts/photo.jpg', type: 'markdown', alt: 'alt text' });
	});

	it('extracts HTML img tags', () => {
		const content = '---\ntitle: Test\n---\n\n<img src="https://example.com/img.png" alt="test" />';
		const images = extractImageUrls(content);
		expect(images).toHaveLength(1);
		expect(images[0]).toEqual({ url: 'https://example.com/img.png', type: 'html', alt: '' });
	});

	it('extracts multiple images', () => {
		const content = '---\ntitle: Test\n---\n\n![a](/a.jpg)\n![b](/b.jpg)\n<img src="/c.jpg" />';
		const images = extractImageUrls(content);
		expect(images).toHaveLength(3);
	});

	it('returns empty array for no images', () => {
		const content = '---\ntitle: Test\n---\n\nJust text, no images.';
		expect(extractImageUrls(content)).toHaveLength(0);
	});

	it('ignores images in frontmatter', () => {
		const content = '---\ntitle: Test\nfeature_image: /images/header.jpg\n---\n\nNo body images.';
		expect(extractImageUrls(content)).toHaveLength(0);
	});
});

describe('isExternalWpUrl', () => {
	it('detects WordPress CDN URLs', () => {
		expect(isExternalWpUrl('https://i0.wp.com/transscendsurvival.org/wp-content/uploads/2020/04/img.jpg')).toBe(true);
	});

	it('detects direct WordPress upload URLs', () => {
		expect(isExternalWpUrl('https://transscendsurvival.org/wp-content/uploads/2020/04/img.jpg')).toBe(true);
	});

	it('rejects local paths', () => {
		expect(isExternalWpUrl('/images/posts/photo.jpg')).toBe(false);
	});

	it('rejects non-WP external URLs', () => {
		expect(isExternalWpUrl('https://github.com/avatar.jpg')).toBe(false);
	});
});

describe('parseCdxResponse', () => {
	it('parses CDX JSON response correctly', () => {
		const rows = [
			['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'],
			['org,transscendsurvival)/wp-content/uploads/img.jpg', '20180601120000', 'https://transscendsurvival.org/wp-content/uploads/img.jpg', 'image/jpeg', '200', 'ABC123', '54321'],
		];
		const result = parseCdxResponse(rows);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			timestamp: '20180601120000',
			original: 'https://transscendsurvival.org/wp-content/uploads/img.jpg',
			mimetype: 'image/jpeg',
			statuscode: '200',
			digest: 'ABC123',
			length: '54321',
		});
	});

	it('returns empty array for empty response', () => {
		expect(parseCdxResponse([])).toHaveLength(0);
		expect(parseCdxResponse(null)).toHaveLength(0);
	});

	it('returns empty for headers-only response', () => {
		const rows = [['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length']];
		expect(parseCdxResponse(rows)).toHaveLength(0);
	});
});
