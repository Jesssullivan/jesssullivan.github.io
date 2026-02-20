#!/usr/bin/env node
/**
 * Generate a tag co-occurrence network graph as SVG (light + dark).
 * Reads tag data from static/blog-stats.json (must run generate-blog-stats.mjs first).
 * Outputs: static/images/tag-graph.svg, static/images/tag-graph-dark.svg
 *
 * Uses a simple force-directed layout (Fruchterman-Reingold style).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const STATS_PATH = 'static/blog-stats.json';
const OUTPUT_LIGHT = 'static/images/tag-graph.svg';
const OUTPUT_DARK = 'static/images/tag-graph-dark.svg';

const WIDTH = 600;
const HEIGHT = 400;
const PADDING = 60;
const ITERATIONS = 200;
const MIN_EDGE_WEIGHT = 2;

// Tag color palette
const TAG_COLORS = {
	Featured: '#e74c3c',
	Ideas: '#3498db',
	Birding: '#2ecc71',
	DIY: '#e67e22',
	'Nature Observations': '#27ae60',
	'How-To': '#9b59b6',
	Music: '#e91e63',
	Headphones: '#f39c12',
	'Waxwing Audio': '#d35400',
	Photography: '#1abc9c',
	Reviews: '#34495e',
	Fitness: '#16a085',
	Electrostatic: '#8e44ad',
	Planar: '#2980b9',
	Classes: '#7f8c8d',
	test: '#95a5a6',
};

function forceDirectedLayout(nodes, edges) {
	const area = (WIDTH - 2 * PADDING) * (HEIGHT - 2 * PADDING);
	const k = Math.sqrt(area / nodes.length) * 0.8;

	// Initialize random positions
	for (const node of nodes) {
		node.x = PADDING + Math.random() * (WIDTH - 2 * PADDING);
		node.y = PADDING + Math.random() * (HEIGHT - 2 * PADDING);
		node.vx = 0;
		node.vy = 0;
	}

	for (let iter = 0; iter < ITERATIONS; iter++) {
		const temp = 1 - iter / ITERATIONS;
		const cooling = temp * k * 0.5;

		// Repulsive forces between all node pairs
		for (let i = 0; i < nodes.length; i++) {
			for (let j = i + 1; j < nodes.length; j++) {
				const dx = nodes[i].x - nodes[j].x;
				const dy = nodes[i].y - nodes[j].y;
				const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
				const force = (k * k) / dist;
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				nodes[i].vx += fx;
				nodes[i].vy += fy;
				nodes[j].vx -= fx;
				nodes[j].vy -= fy;
			}
		}

		// Attractive forces along edges
		for (const edge of edges) {
			const src = nodes.find(n => n.id === edge.source);
			const tgt = nodes.find(n => n.id === edge.target);
			if (!src || !tgt) continue;
			const dx = tgt.x - src.x;
			const dy = tgt.y - src.y;
			const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
			const force = (dist * dist) / k * (edge.weight / 10);
			const fx = (dx / dist) * force;
			const fy = (dy / dist) * force;
			src.vx += fx;
			src.vy += fy;
			tgt.vx -= fx;
			tgt.vy -= fy;
		}

		// Apply velocities with cooling
		for (const node of nodes) {
			const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
			if (speed > 0) {
				const capped = Math.min(speed, cooling);
				node.x += (node.vx / speed) * capped;
				node.y += (node.vy / speed) * capped;
			}
			// Clamp to bounds
			node.x = Math.max(PADDING, Math.min(WIDTH - PADDING, node.x));
			node.y = Math.max(PADDING, Math.min(HEIGHT - PADDING, node.y));
			node.vx = 0;
			node.vy = 0;
		}
	}
}

function renderSVG(nodes, edges, dark = false) {
	const bg = dark ? '#0d1117' : '#ffffff';
	const textColor = dark ? '#c9d1d9' : '#24292f';
	const edgeColor = dark ? 'rgba(139,148,158,0.3)' : 'rgba(100,100,100,0.2)';
	const titleColor = dark ? '#58a6ff' : '#0969da';

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
<rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}" rx="8"/>
<text x="${WIDTH/2}" y="22" text-anchor="middle" font-family="sans-serif" font-size="12" font-weight="600" fill="${titleColor}">Tag Co-occurrence Network</text>
`;

	// Draw edges
	for (const edge of edges) {
		const src = nodes.find(n => n.id === edge.source);
		const tgt = nodes.find(n => n.id === edge.target);
		if (!src || !tgt) continue;
		const opacity = Math.min(0.8, 0.15 + edge.weight * 0.05);
		const strokeWidth = Math.max(1, Math.min(4, edge.weight * 0.5));
		svg += `<line x1="${src.x.toFixed(1)}" y1="${src.y.toFixed(1)}" x2="${tgt.x.toFixed(1)}" y2="${tgt.y.toFixed(1)}" stroke="${dark ? '#8b949e' : '#6a737d'}" stroke-opacity="${opacity}" stroke-width="${strokeWidth}"/>
`;
	}

	// Draw nodes
	for (const node of nodes) {
		const color = TAG_COLORS[node.id] || '#7f8c8d';
		const r = Math.max(6, Math.min(18, 4 + node.count * 0.4));
		svg += `<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${r}" fill="${color}" opacity="0.85"/>
`;
		svg += `<text x="${node.x.toFixed(1)}" y="${(node.y - r - 3).toFixed(1)}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="${textColor}" opacity="0.9">${escapeXml(node.id)}</text>
`;
	}

	// Footer
	svg += `<text x="${WIDTH/2}" y="${HEIGHT - 8}" text-anchor="middle" font-family="sans-serif" font-size="8" fill="${textColor}" opacity="0.5">${nodes.length} tags, ${edges.length} co-occurrence edges (min weight: ${MIN_EDGE_WEIGHT})</text>
`;

	svg += '</svg>';
	return svg;
}

function escapeXml(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function main() {
	const statsRaw = await readFile(STATS_PATH, 'utf-8');
	const stats = JSON.parse(statsRaw);

	// Build nodes from top tags
	const tagEntries = Object.entries(stats.topTags);
	const nodes = tagEntries.map(([tag, count]) => ({
		id: tag,
		count,
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
	}));

	// Build edges from co-occurrence (filter by min weight)
	const nodeIds = new Set(nodes.map(n => n.id));
	const edges = stats.tagCooccurrence
		.filter(e => e.weight >= MIN_EDGE_WEIGHT && nodeIds.has(e.source) && nodeIds.has(e.target));

	if (nodes.length < 2) {
		console.log('Not enough tags to generate graph');
		return;
	}

	// Layout
	forceDirectedLayout(nodes, edges);

	// Render light + dark
	await mkdir('static/images', { recursive: true });
	await writeFile(OUTPUT_LIGHT, renderSVG(nodes, edges, false));
	await writeFile(OUTPUT_DARK, renderSVG(nodes, edges, true));

	console.log(`Tag graph: ${nodes.length} nodes, ${edges.length} edges -> ${OUTPUT_LIGHT}, ${OUTPUT_DARK}`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
