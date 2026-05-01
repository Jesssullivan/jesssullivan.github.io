import { describe, expect, it } from 'vitest';
import { sha256Digest } from '../src/broker/sha256.js';

describe('broker/sha256', () => {
	it('matches published SHA-256 test vectors', () => {
		expect(sha256Digest('')).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
		expect(sha256Digest('abc')).toBe('sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	});
});
