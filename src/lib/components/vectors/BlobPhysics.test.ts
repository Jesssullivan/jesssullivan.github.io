import { describe, it, expect } from 'vitest';
import { BlobPhysics } from './BlobPhysics';

describe('BlobPhysics', () => {
	describe('initialization', () => {
		it('creates blobs in light mode', () => {
			const physics = new BlobPhysics(false);
			const blobs = physics.initializeBlobs();
			expect(blobs.length).toBe(5); // 5 light mode colors
		});

		it('creates blobs in dark mode', () => {
			const physics = new BlobPhysics(true);
			const blobs = physics.initializeBlobs();
			expect(blobs.length).toBe(5); // 5 dark mode colors
		});

		it('blobs have valid positions', () => {
			const physics = new BlobPhysics(false);
			const blobs = physics.initializeBlobs();
			for (const blob of blobs) {
				expect(blob.currentX).toBeGreaterThanOrEqual(-40);
				expect(blob.currentX).toBeLessThanOrEqual(140);
				expect(blob.currentY).toBeGreaterThanOrEqual(-40);
				expect(blob.currentY).toBeLessThanOrEqual(140);
			}
		});

		it('blobs have valid sizes', () => {
			const physics = new BlobPhysics(false);
			const blobs = physics.initializeBlobs();
			for (const blob of blobs) {
				expect(blob.size).toBeGreaterThanOrEqual(28);
				expect(blob.size).toBeLessThanOrEqual(46);
			}
		});

		it('blobs have 16 control points each', () => {
			const physics = new BlobPhysics(false);
			const blobs = physics.initializeBlobs();
			for (const blob of blobs) {
				expect(blob.controlPoints.length).toBe(16);
				expect(blob.controlVelocities.length).toBe(16);
			}
		});

		it('each blob has a unique gradientId', () => {
			const physics = new BlobPhysics(false);
			const blobs = physics.initializeBlobs();
			const ids = blobs.map((b) => b.gradientId);
			expect(new Set(ids).size).toBe(ids.length);
		});
	});

	describe('update', () => {
		it('updates blob positions on each tick', () => {
			const physics = new BlobPhysics(false);
			const blobs = physics.initializeBlobs();
			const initialPositions = blobs.map((b) => ({ x: b.currentX, y: b.currentY }));

			// Run several update cycles
			for (let i = 0; i < 10; i++) {
				physics.update(0.016, i * 0.016, 0, []);
			}

			const updatedBlobs = physics.getBlobs();
			let moved = false;
			for (let i = 0; i < updatedBlobs.length; i++) {
				if (
					updatedBlobs[i].currentX !== initialPositions[i].x ||
					updatedBlobs[i].currentY !== initialPositions[i].y
				) {
					moved = true;
					break;
				}
			}
			expect(moved).toBe(true);
		});

		it('blobs stay within physics bounds after many updates', () => {
			const physics = new BlobPhysics(false);
			physics.initializeBlobs();

			for (let i = 0; i < 100; i++) {
				physics.update(0.016, i * 0.016, 0, []);
			}

			for (const blob of physics.getBlobs()) {
				expect(blob.currentX).toBeGreaterThanOrEqual(-60);
				expect(blob.currentX).toBeLessThanOrEqual(160);
				expect(blob.currentY).toBeGreaterThanOrEqual(-60);
				expect(blob.currentY).toBeLessThanOrEqual(160);
			}
		});
	});

	describe('theme switching', () => {
		it('updateTheme changes blob colors', () => {
			const physics = new BlobPhysics(false);
			const blobs = physics.initializeBlobs();
			const lightColors = blobs.map((b) => b.color);

			physics.updateTheme(true);
			const darkColors = physics.getBlobs().map((b) => b.color);

			expect(lightColors).not.toEqual(darkColors);
		});

		it('updateTheme is idempotent for same mode', () => {
			const physics = new BlobPhysics(false);
			physics.initializeBlobs();
			const colors1 = physics.getBlobs().map((b) => b.color);

			physics.updateTheme(false);
			const colors2 = physics.getBlobs().map((b) => b.color);

			expect(colors1).toEqual(colors2);
		});
	});

	describe('generateSmoothBlobPath', () => {
		it('generates a valid SVG path', () => {
			const physics = new BlobPhysics(false);
			const blobs = physics.initializeBlobs();
			const path = physics.generateSmoothBlobPath(blobs[0]);

			expect(path).toContain('M');
			expect(path).toContain('C');
			expect(path).toContain('Z');
		});

		it('generates a fallback circle for blobs without control points', () => {
			const physics = new BlobPhysics(false);
			const blob = physics.initializeBlobs()[0];
			blob.controlPoints = [];
			const path = physics.generateSmoothBlobPath(blob);

			expect(path).toContain('A');
		});
	});
});
