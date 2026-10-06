// Hand-rolled WebGL2 layer for the project map: a soft glow per project,
// tinted by category (qualitative layout density, R76; never a claim of
// expertise), the similarity edges, and a shimmer that runs along the
// hovered project's edges only while it is hovered. Markers, labels and all
// interaction live in the SVG/HTML overlay; this canvas is aria-hidden.
import type { Scene } from './mapScene';
import type { MapTokens, Rgb } from './themeTokens';

export interface LayerFrame {
	/** d3-zoom transform: screen = stage * k + (x, y). */
	transform: { k: number; x: number; y: number };
	/** Stage-pixel positions, two floats per node. */
	positions: Float32Array;
	/** Per-node opacity (entrance progress x legend visibility x search). */
	alpha: Float32Array;
	/** Hovered or focused node, or -1. */
	hovered: number;
	/** Seconds; drives the shimmer phase. */
	time: number;
	/** False under prefers-reduced-motion: highlighted edges stay still. */
	shimmer: boolean;
}

export interface MapLayer {
	readonly kind: 'webgl2' | 'canvas2d';
	resize(width: number, height: number, dpr: number): void;
	setScene(scene: Scene, tokens: MapTokens): void;
	setTokens(tokens: MapTokens): void;
	render(frame: LayerFrame): void;
	destroy(): void;
}

/** Glow radius as a fraction of the plot side (the producer's radius_normalized). */
export const GLOW_RADIUS = 0.095;

const GLOW_VS = `#version 300 es
in vec2 a_corner;
in vec2 a_center;
in vec4 a_color;
uniform vec2 u_view;
uniform vec3 u_zoom;
uniform float u_radius;
out vec2 v_uv;
out vec4 v_color;
void main() {
	vec2 c = a_center * u_zoom.x + u_zoom.yz;
	vec2 p = c + a_corner * u_radius * u_zoom.x;
	vec2 clip = (p / u_view) * 2.0 - 1.0;
	gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
	v_uv = a_corner;
	v_color = a_color;
}`;

const GLOW_FS = `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec4 v_color;
out vec4 o;
void main() {
	float d2 = dot(v_uv, v_uv);
	if (d2 > 1.0) discard;
	float g = exp(-d2 * 3.2) * (1.0 - d2);
	float a = v_color.a * g;
	o = vec4(v_color.rgb * a, a);
}`;

const EDGE_VS = `#version 300 es
in vec2 a_corner;
in vec4 a_ends;
in vec4 a_style;
uniform vec2 u_view;
uniform vec3 u_zoom;
out float v_along;
out float v_across;
out float v_len;
out vec4 v_style;
void main() {
	vec2 A = a_ends.xy * u_zoom.x + u_zoom.yz;
	vec2 B = a_ends.zw * u_zoom.x + u_zoom.yz;
	vec2 d = B - A;
	float len = max(length(d), 0.0001);
	vec2 n = vec2(-d.y, d.x) / len;
	float width = mix(1.1, 2.6, a_style.x) + 1.0;
	vec2 p = A + d * a_corner.x + n * a_corner.y * width * 0.5;
	vec2 clip = (p / u_view) * 2.0 - 1.0;
	gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
	v_along = a_corner.x;
	v_across = a_corner.y;
	v_len = len;
	v_style = a_style;
}`;

const EDGE_FS = `#version 300 es
precision mediump float;
in float v_along;
in float v_across;
in float v_len;
in vec4 v_style;
uniform vec3 u_edge;
uniform vec3 u_focus;
uniform float u_time;
uniform float u_shimmer;
out vec4 o;
void main() {
	float hl = v_style.x;
	float w = v_style.y;
	float aa = 1.0 - smoothstep(0.55, 1.0, abs(v_across));
	float base = mix(0.16 + 0.42 * w, 0.9, hl);
	float wave = 0.5 + 0.5 * sin(v_along * v_len * 0.07 - u_time * 5.5 + v_style.z);
	float shimmer = mix(1.0, 0.45 + 0.75 * wave * wave, hl * u_shimmer);
	vec3 rgb = mix(u_edge, u_focus, hl);
	float a = base * shimmer * aa * v_style.w;
	o = vec4(rgb * a, a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error('shader allocation failed');
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`shader compile failed: ${log}`);
	}
	return shader;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
	const p = gl.createProgram();
	if (!p) throw new Error('program allocation failed');
	const v = compile(gl, gl.VERTEX_SHADER, vs);
	const f = compile(gl, gl.FRAGMENT_SHADER, fs);
	gl.attachShader(p, v);
	gl.attachShader(p, f);
	gl.linkProgram(p);
	gl.deleteShader(v);
	gl.deleteShader(f);
	if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program link failed: ${gl.getProgramInfoLog(p)}`);
	return p;
}

interface Attrib {
	name: string;
	size: number;
	divisor: number;
	buffer: WebGLBuffer;
	stride?: number;
	offset?: number;
}

function bindAttribs(gl: WebGL2RenderingContext, p: WebGLProgram, attribs: Attrib[]): void {
	for (const a of attribs) {
		const loc = gl.getAttribLocation(p, a.name);
		if (loc < 0) continue;
		gl.bindBuffer(gl.ARRAY_BUFFER, a.buffer);
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, a.size, gl.FLOAT, false, a.stride ?? 0, a.offset ?? 0);
		gl.vertexAttribDivisor(loc, a.divisor);
	}
}

/** WebGL2 map layer, or null when WebGL2 is unavailable (use canvasLayer). */
export function createGlLayer(canvas: HTMLCanvasElement, onLost?: () => void): MapLayer | null {
	let gl: WebGL2RenderingContext | null = null;
	try {
		gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: true, alpha: true });
	} catch {
		gl = null;
	}
	if (!gl) return null;
	const g = gl;

	let glowProgram: WebGLProgram;
	let edgeProgram: WebGLProgram;
	try {
		glowProgram = program(g, GLOW_VS, GLOW_FS);
		edgeProgram = program(g, EDGE_VS, EDGE_FS);
	} catch {
		return null;
	}

	const quad = g.createBuffer()!;
	g.bindBuffer(g.ARRAY_BUFFER, quad);
	g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
	const strip = g.createBuffer()!;
	g.bindBuffer(g.ARRAY_BUFFER, strip);
	g.bufferData(g.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), g.STATIC_DRAW);

	const glowCenters = g.createBuffer()!;
	const glowColors = g.createBuffer()!;
	const edgeEnds = g.createBuffer()!;
	const edgeStyles = g.createBuffer()!;

	const glowVao = g.createVertexArray()!;
	g.bindVertexArray(glowVao);
	bindAttribs(g, glowProgram, [
		{ name: 'a_corner', size: 2, divisor: 0, buffer: quad },
		{ name: 'a_center', size: 2, divisor: 1, buffer: glowCenters },
		{ name: 'a_color', size: 4, divisor: 1, buffer: glowColors },
	]);
	const edgeVao = g.createVertexArray()!;
	g.bindVertexArray(edgeVao);
	bindAttribs(g, edgeProgram, [
		{ name: 'a_corner', size: 2, divisor: 0, buffer: strip },
		{ name: 'a_ends', size: 4, divisor: 1, buffer: edgeEnds },
		{ name: 'a_style', size: 4, divisor: 1, buffer: edgeStyles },
	]);
	g.bindVertexArray(null);

	const u = {
		glowView: g.getUniformLocation(glowProgram, 'u_view'),
		glowZoom: g.getUniformLocation(glowProgram, 'u_zoom'),
		glowRadius: g.getUniformLocation(glowProgram, 'u_radius'),
		edgeView: g.getUniformLocation(edgeProgram, 'u_view'),
		edgeZoom: g.getUniformLocation(edgeProgram, 'u_zoom'),
		edgeColor: g.getUniformLocation(edgeProgram, 'u_edge'),
		edgeFocus: g.getUniformLocation(edgeProgram, 'u_focus'),
		edgeTime: g.getUniformLocation(edgeProgram, 'u_time'),
		edgeShimmer: g.getUniformLocation(edgeProgram, 'u_shimmer'),
	};

	let width = 1;
	let height = 1;
	let scene: Scene | null = null;
	let tokens: MapTokens | null = null;
	let lost = false;
	let colorData = new Float32Array(0);
	let endData = new Float32Array(0);
	let styleData = new Float32Array(0);
	let centerData = new Float32Array(0);

	const onContextLost = (event: Event) => {
		event.preventDefault();
		lost = true;
		onLost?.();
	};
	canvas.addEventListener('webglcontextlost', onContextLost);

	function catColor(i: number): Rgb {
		const list = tokens?.categories ?? [];
		return list[i % Math.max(1, list.length)] ?? [0.5, 0.5, 0.5];
	}

	return {
		kind: 'webgl2',
		resize(w, h, dpr) {
			width = Math.max(1, w);
			height = Math.max(1, h);
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			g.viewport(0, 0, canvas.width, canvas.height);
		},
		setScene(next, nextTokens) {
			scene = next;
			tokens = nextTokens;
			colorData = new Float32Array(next.nodes.length * 4);
			centerData = new Float32Array(next.nodes.length * 2);
			endData = new Float32Array(next.edges.length * 4);
			styleData = new Float32Array(next.edges.length * 4);
		},
		setTokens(nextTokens) {
			tokens = nextTokens;
		},
		render(frame) {
			if (lost || !scene || !tokens) return;
			const { k, x, y } = frame.transform;
			const dark = tokens.mode === 'dark';
			g.clearColor(0, 0, 0, 0);
			g.clear(g.COLOR_BUFFER_BIT);
			g.enable(g.BLEND);

			// Glow: additive on dark grounds, premultiplied "over" on light ones.
			for (const n of scene.nodes) {
				const c = catColor(n.catIndex);
				const a = frame.alpha[n.index] * (dark ? 0.3 : 0.22) * (frame.hovered === n.index ? 1.6 : 1);
				colorData.set([c[0], c[1], c[2], a], n.index * 4);
				centerData[n.index * 2] = frame.positions[n.index * 2];
				centerData[n.index * 2 + 1] = frame.positions[n.index * 2 + 1];
			}
			g.blendFunc(g.ONE, dark ? g.ONE : g.ONE_MINUS_SRC_ALPHA);
			g.useProgram(glowProgram);
			g.uniform2f(u.glowView, width, height);
			g.uniform3f(u.glowZoom, k, x, y);
			g.uniform1f(u.glowRadius, scene.plot.size * GLOW_RADIUS);
			g.bindBuffer(g.ARRAY_BUFFER, glowCenters);
			g.bufferData(g.ARRAY_BUFFER, centerData, g.DYNAMIC_DRAW);
			g.bindBuffer(g.ARRAY_BUFFER, glowColors);
			g.bufferData(g.ARRAY_BUFFER, colorData, g.DYNAMIC_DRAW);
			g.bindVertexArray(glowVao);
			g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, scene.nodes.length);

			// Edges: faint by weight; the hovered project's edges light up.
			scene.edges.forEach((e, i) => {
				const hl = frame.hovered >= 0 && (e.a === frame.hovered || e.b === frame.hovered) ? 1 : 0;
				endData.set(
					[
						frame.positions[e.a * 2],
						frame.positions[e.a * 2 + 1],
						frame.positions[e.b * 2],
						frame.positions[e.b * 2 + 1],
					],
					i * 4,
				);
				const vis = Math.min(frame.alpha[e.a], frame.alpha[e.b]);
				const dim = frame.hovered >= 0 && !hl ? 0.45 : 1;
				styleData.set([hl, e.w, i * 1.7, vis * dim], i * 4);
			});
			g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
			g.useProgram(edgeProgram);
			g.uniform2f(u.edgeView, width, height);
			g.uniform3f(u.edgeZoom, k, x, y);
			g.uniform3f(u.edgeColor, ...tokens.edge);
			g.uniform3f(u.edgeFocus, ...(frame.hovered >= 0 ? catColor(scene.nodes[frame.hovered].catIndex) : tokens.focus));
			g.uniform1f(u.edgeTime, frame.time);
			g.uniform1f(u.edgeShimmer, frame.shimmer ? 1 : 0);
			g.bindBuffer(g.ARRAY_BUFFER, edgeEnds);
			g.bufferData(g.ARRAY_BUFFER, endData, g.DYNAMIC_DRAW);
			g.bindBuffer(g.ARRAY_BUFFER, edgeStyles);
			g.bufferData(g.ARRAY_BUFFER, styleData, g.DYNAMIC_DRAW);
			g.bindVertexArray(edgeVao);
			g.drawArraysInstanced(g.TRIANGLE_STRIP, 0, 4, scene.edges.length);
			g.bindVertexArray(null);
		},
		destroy() {
			canvas.removeEventListener('webglcontextlost', onContextLost);
			for (const b of [quad, strip, glowCenters, glowColors, edgeEnds, edgeStyles]) g.deleteBuffer(b);
			g.deleteVertexArray(glowVao);
			g.deleteVertexArray(edgeVao);
			g.deleteProgram(glowProgram);
			g.deleteProgram(edgeProgram);
		},
	};
}
