import { describe, it, expect, vi } from 'vitest';
import { ScrollHandler } from './ScrollHandler';

// Mock requestAnimationFrame
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
	setTimeout(() => cb(performance.now()), 0);
	return 0;
});

// Mock WheelEvent for Node.js
function createWheelEvent(deltaY: number): WheelEvent {
	return { deltaY } as unknown as WheelEvent;
}

describe('ScrollHandler', () => {
	it('starts with zero stickiness', () => {
		const handler = new ScrollHandler();
		expect(handler.getStickiness()).toBe(0);
	});

	it('starts with empty pull forces', () => {
		const handler = new ScrollHandler();
		expect(handler.getPullForces()).toEqual([]);
	});

	it('increases stickiness on scroll event', () => {
		const handler = new ScrollHandler();
		handler.handleScroll(createWheelEvent(100));
		expect(handler.getStickiness()).toBeGreaterThan(0);
	});

	it('generates pull forces on significant scroll', () => {
		const handler = new ScrollHandler();
		for (let i = 0; i < 5; i++) {
			handler.handleScroll(createWheelEvent(200));
		}
		expect(handler.getPullForces().length).toBeGreaterThan(0);
	});

	it('pull forces have expected shape', () => {
		const handler = new ScrollHandler();
		for (let i = 0; i < 3; i++) {
			handler.handleScroll(createWheelEvent(200));
		}
		const forces = handler.getPullForces();
		if (forces.length > 0) {
			const force = forces[0];
			expect(force).toHaveProperty('strength');
			expect(force).toHaveProperty('time');
			expect(force).toHaveProperty('randomness');
			expect(force).toHaveProperty('explosive');
			expect(typeof force.strength).toBe('number');
			expect(typeof force.explosive).toBe('boolean');
		}
	});
});
