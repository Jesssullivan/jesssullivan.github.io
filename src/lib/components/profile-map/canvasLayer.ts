// Canvas 2D fallback with the same contract as glLayer (no WebGL2, or a lost
// context): radial glows per project tinted by category, similarity edges,
// and a moving highlight along the hovered project's edges while hovered.
import { GLOW_RADIUS, type LayerFrame, type MapLayer } from './glLayer';
import type { Scene } from './mapScene';
import { rgbCss, type MapTokens, type Rgb } from './themeTokens';

export function createCanvasLayer(canvas: HTMLCanvasElement): MapLayer | null {
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	const c = ctx;
	let width = 1;
	let height = 1;
	let dpr = 1;
	let scene: Scene | null = null;
	let tokens: MapTokens | null = null;

	function catColor(i: number): Rgb {
		const list = tokens?.categories ?? [];
		return list[i % Math.max(1, list.length)] ?? [0.5, 0.5, 0.5];
	}

	return {
		kind: 'canvas2d',
		resize(w, h, ratio) {
			width = Math.max(1, w);
			height = Math.max(1, h);
			dpr = ratio;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
		},
		setScene(next, nextTokens) {
			scene = next;
			tokens = nextTokens;
		},
		setTokens(nextTokens) {
			tokens = nextTokens;
		},
		render(frame: LayerFrame) {
			if (!scene || !tokens) return;
			const { k, x, y } = frame.transform;
			const dark = tokens.mode === 'dark';
			const px = (i: number) => frame.positions[i * 2] * k + x;
			const py = (i: number) => frame.positions[i * 2 + 1] * k + y;
			c.setTransform(dpr, 0, 0, dpr, 0, 0);
			c.clearRect(0, 0, width, height);

			const r = scene.plot.size * GLOW_RADIUS * k;
			c.globalCompositeOperation = dark ? 'lighter' : 'source-over';
			for (const n of scene.nodes) {
				const a = frame.alpha[n.index] * (dark ? 0.3 : 0.22) * (frame.hovered === n.index ? 1.6 : 1);
				if (a <= 0) continue;
				const col = catColor(n.catIndex);
				const gx = px(n.index);
				const gy = py(n.index);
				const grad = c.createRadialGradient(gx, gy, 0, gx, gy, r);
				grad.addColorStop(0, rgbCss(col, a));
				grad.addColorStop(0.45, rgbCss(col, a * 0.35));
				grad.addColorStop(1, rgbCss(col, 0));
				c.fillStyle = grad;
				c.beginPath();
				c.arc(gx, gy, r, 0, Math.PI * 2);
				c.fill();
			}

			c.globalCompositeOperation = 'source-over';
			c.lineCap = 'round';
			const focus = frame.hovered >= 0 ? catColor(scene.nodes[frame.hovered].catIndex) : tokens.focus;
			scene.edges.forEach((e, i) => {
				const hl = frame.hovered >= 0 && (e.a === frame.hovered || e.b === frame.hovered);
				const vis = Math.min(frame.alpha[e.a], frame.alpha[e.b]) * (frame.hovered >= 0 && !hl ? 0.45 : 1);
				if (vis <= 0) return;
				const ax = px(e.a);
				const ay = py(e.a);
				const bx = px(e.b);
				const by = py(e.b);
				if (hl) {
					c.lineWidth = 2.4;
					if (frame.shimmer) {
						const grad = c.createLinearGradient(ax, ay, bx, by);
						const head = (frame.time * 0.8 + i * 0.27) % 1;
						grad.addColorStop(0, rgbCss(focus, 0.55 * vis));
						grad.addColorStop(Math.max(0, head - 0.15), rgbCss(focus, 0.55 * vis));
						grad.addColorStop(head, rgbCss(focus, vis));
						grad.addColorStop(Math.min(1, head + 0.15), rgbCss(focus, 0.55 * vis));
						grad.addColorStop(1, rgbCss(focus, 0.55 * vis));
						c.strokeStyle = grad;
					} else {
						c.strokeStyle = rgbCss(focus, 0.9 * vis);
					}
				} else {
					c.lineWidth = 1.1;
					c.strokeStyle = rgbCss(tokens!.edge, (0.16 + 0.42 * e.w) * vis);
				}
				c.beginPath();
				c.moveTo(ax, ay);
				c.lineTo(bx, by);
				c.stroke();
			});
		},
		destroy() {
			c.clearRect(0, 0, canvas.width, canvas.height);
		},
	};
}
