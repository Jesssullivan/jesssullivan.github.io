#!/usr/bin/env node
/**
 * Generate mock AP outbox with realistic activity data.
 * Run manually: tsx scripts/generate-mock-outbox.mts
 * Output: scripts/data/mock-outbox.json
 */
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const OUTPUT = 'scripts/data/mock-outbox.json';
const ACTOR = 'https://tinyland.dev/@jesssullivan';
const BASE = 'https://tinyland.dev';

function uuid(seed: string): string {
	return createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

function randomBetween(min: number, max: number, seed: number): number {
	const x = Math.sin(seed) * 10000;
	const r = x - Math.floor(x);
	return min + r * (max - min);
}

function pick<T>(arr: T[], seed: number): T {
	const x = Math.sin(seed) * 10000;
	const r = x - Math.floor(x);
	return arr[Math.floor(r * arr.length)];
}

const BIRDS = [
	{ species: 'Pileated Woodpecker', scientific: 'Dryocopus pileatus' },
	{ species: 'Black-capped Chickadee', scientific: 'Poecile atricapillus' },
	{ species: 'Common Loon', scientific: 'Gavia immer' },
	{ species: 'Barred Owl', scientific: 'Strix varia' },
	{ species: 'Great Blue Heron', scientific: 'Ardea herodias' },
	{ species: 'Red-tailed Hawk', scientific: 'Buteo jamaicensis' },
	{ species: 'Eastern Bluebird', scientific: 'Sialia sialis' },
	{ species: 'Ruby-throated Hummingbird', scientific: 'Archilochus colubris' },
	{ species: 'American Robin', scientific: 'Turdus migratorius' },
	{ species: 'White-breasted Nuthatch', scientific: 'Sitta carolinensis' },
	{ species: 'Cedar Waxwing', scientific: 'Bombycilla cedrorum' },
	{ species: 'Hermit Thrush', scientific: 'Catharus guttatus' },
];

const LOCATIONS = [
	{ name: 'Thorncrag Bird Sanctuary', lat: 44.1003, lon: -70.2148 },
	{ name: 'Range Pond State Park', lat: 44.0667, lon: -70.3500 },
	{ name: 'Androscoggin Riverlands', lat: 44.0412, lon: -70.1823 },
	{ name: 'Sabattus Pond', lat: 44.1209, lon: -70.0874 },
	{ name: 'Bradbury Mountain', lat: 43.9017, lon: -70.1678 },
	{ name: 'Lost Valley trails', lat: 44.0889, lon: -70.2456 },
];

const BIKE_ROUTES = [
	'Androscoggin River Trail',
	'Lisbon Falls loop',
	'Turner Center hill climb',
	'Sabattus to Lewiston connector',
	'Auburn riverwalk to Lake Auburn',
	'Nezinscot River road',
];

const REPOS = [
	'jesssullivan.github.io',
	'XoxdWM',
	'aperture-bootstrap',
	'cmux',
	'scheduling-kit',
	'acuity-middleware',
];

const LANGUAGES = ['TypeScript', 'Svelte', 'Chapel', 'Nix', 'Rust', 'Zig', 'Python', 'CSS'];

const NOTES = [
	'Finally got the Dell 7810 stable on the RT kernel- four weeks of chasing SMI ghosts but the hwlat numbers are clean now.',
	'Nix flake for the Chapel toolchain is reproducible on both darwin and rocky. One derivation, two platforms. Feels good.',
	'The blog prebuild pipeline is getting comically long but every step earns its keep. 6 scripts chained before vite even starts.',
	'Reading through the Zag.js source for the scroll-area machine. The state chart is beautiful- might propose a Skeleton wrapper.',
	'Three hours deep in EDID parsing. The Bigscreen Beyond reports a non-desktop display type but the kernel ignores it. Fun.',
	'Baked a sourdough loaf while waiting for molecule tests. Both turned out better than expected.',
	'Spring peepers are deafening tonight. Walked down to the pond with a headlamp and counted at least forty calling.',
	'Rebuilt the Ghostty submodule pin for cmux. 282 commits ahead of upstream now- the fork drift is real.',
	'Tried $state.eager() for the theme switcher. Instant visual feedback even during page transitions. Svelte 5 keeps delivering.',
	'The tinyvectors extraction is cleaner than I expected. Bazel builds the package, npm publishes it, CI validates the round trip.',
	'Morning fog on the Androscoggin. Perfect conditions for great blue herons- counted six in a half-mile stretch.',
	'Passkey enrollment on the Yubikey 5C finally works with the new FIDO2 bridge in cmux. No more password prompts.',
];

interface Activity {
	'@context': (string | Record<string, string>)[];
	type: string;
	id: string;
	actor: string;
	published: string;
	object: Record<string, unknown>;
}

function makeActivity(
	published: Date,
	seed: number,
	obj: Record<string, unknown>,
): Activity {
	const id = uuid(`${published.toISOString()}-${seed}`);
	return {
		'@context': [
			'https://www.w3.org/ns/activitystreams',
			{ tl: 'https://tinyland.dev/ns/v1#' },
		],
		type: 'Create',
		id: `${BASE}/activities/${id}`,
		actor: ACTOR,
		published: published.toISOString(),
		object: {
			type: 'Note',
			id: `${BASE}/notes/${id}`,
			published: published.toISOString(),
			attributedTo: ACTOR,
			...obj,
		},
	};
}

function makeBird(published: Date, seed: number): Activity {
	const bird = pick(BIRDS, seed);
	const loc = pick(LOCATIONS, seed + 1);
	const count = Math.floor(randomBetween(1, 5, seed + 2));
	const plural = count > 1 ? 's' : '';
	return makeActivity(published, seed, {
		content: `<p>Spotted ${count} ${bird.species}${plural} at ${loc.name}${count > 1 ? '- feeding together in the canopy' : ''}.</p>`,
		tag: [{ type: 'Hashtag', name: '#birding' }, { type: 'Hashtag', name: '#maine' }],
		'tl:birdSighting': {
			species: bird.species,
			scientificName: bird.scientific,
			location: { type: 'Place', name: loc.name, latitude: loc.lat, longitude: loc.lon },
			count,
		},
	});
}

function makeBike(published: Date, seed: number): Activity {
	const route = pick(BIKE_ROUTES, seed);
	const distance = parseFloat(randomBetween(5, 28, seed + 1).toFixed(1));
	const duration = Math.round(distance * randomBetween(3.5, 5.5, seed + 2));
	const elevation = Math.round(randomBetween(100, 800, seed + 3));
	return makeActivity(published, seed, {
		content: `<p>${distance} mi ride along the ${route}. ${duration} minutes, ${elevation} ft elevation.</p>`,
		tag: [{ type: 'Hashtag', name: '#cycling' }, { type: 'Hashtag', name: '#maine' }],
		'tl:bikeRide': { distanceMiles: distance, durationMinutes: duration, route, elevationGainFeet: elevation },
	});
}

function makeCode(published: Date, seed: number): Activity {
	const repo = pick(REPOS, seed);
	const added = Math.round(randomBetween(3, 280, seed + 1));
	const removed = Math.round(randomBetween(0, added * 0.6, seed + 2));
	const commits = Math.max(1, Math.round(randomBetween(1, 8, seed + 3)));
	const langs = [pick(LANGUAGES, seed + 4), pick(LANGUAGES, seed + 5)].filter(
		(v, i, a) => a.indexOf(v) === i,
	);
	return makeActivity(published, seed, {
		content: `<p>+${added}/-${removed} lines across ${commits} commit${commits > 1 ? 's' : ''} in ${repo}.</p>`,
		tag: [{ type: 'Hashtag', name: '#code' }],
		'tl:codeActivity': { linesAdded: added, linesRemoved: removed, commits, repository: repo, languages: langs },
	});
}

function makeSensor(published: Date, seed: number): Activity {
	const tempC = parseFloat(randomBetween(18, 26, seed + 1).toFixed(1));
	const humidity = Math.round(randomBetween(30, 65, seed + 2));
	const co2 = Math.round(randomBetween(420, 900, seed + 3));
	return makeActivity(published, seed, {
		content: `<p>Office: ${tempC}C, ${humidity}% humidity, CO2 ${co2}ppm.</p>`,
		tag: [{ type: 'Hashtag', name: '#sensors' }],
		'tl:sensorReading': {
			sensorId: 'office-env-01',
			sensorType: 'environmental' as const,
			measurements: [
				{ name: 'Temperature', value: tempC, unit: 'C' },
				{ name: 'Humidity', value: humidity, unit: '%' },
				{ name: 'CO2', value: co2, unit: 'ppm' },
			],
		},
	});
}

function makeNote(published: Date, seed: number): Activity {
	const note = pick(NOTES, seed);
	return makeActivity(published, seed, {
		content: `<p>${note}</p>`,
		tag: [{ type: 'Hashtag', name: '#notes' }],
	});
}

// Weighted distribution: notes 35%, birds 25%, code 20%, bike 12%, sensor 8%
type Generator = (published: Date, seed: number) => Activity;
const GENERATORS: [number, Generator][] = [
	[0.35, makeNote],
	[0.60, makeBird],
	[0.80, makeCode],
	[0.92, makeBike],
	[1.00, makeSensor],
];

function pickGenerator(seed: number): Generator {
	const r = randomBetween(0, 1, seed);
	for (const [threshold, gen] of GENERATORS) {
		if (r < threshold) return gen;
	}
	return makeNote;
}

async function main(): Promise<void> {
	const now = new Date();
	const activities: Activity[] = [];
	const count = 75;

	for (let i = 0; i < count; i++) {
		const daysAgo = (i / count) * 90;
		const hoursOffset = randomBetween(-4, 4, i * 7);
		const published = new Date(now.getTime() - (daysAgo * 24 + hoursOffset) * 60 * 60 * 1000);
		const gen = pickGenerator(i * 13);
		activities.push(gen(published, i * 17));
	}

	activities.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

	const outbox = {
		'@context': 'https://www.w3.org/ns/activitystreams',
		id: `${ACTOR}/outbox`,
		type: 'OrderedCollection',
		totalItems: activities.length,
		orderedItems: activities,
	};

	await writeFile(OUTPUT, JSON.stringify(outbox, null, 2));
	console.log(`Mock outbox: ${activities.length} activities -> ${OUTPUT}`);

	const kinds = { note: 0, bird: 0, code: 0, bike: 0, sensor: 0 };
	for (const a of activities) {
		const obj = a.object as Record<string, unknown>;
		if (obj['tl:birdSighting']) kinds.bird++;
		else if (obj['tl:bikeRide']) kinds.bike++;
		else if (obj['tl:codeActivity']) kinds.code++;
		else if (obj['tl:sensorReading']) kinds.sensor++;
		else kinds.note++;
	}
	console.log(`  Distribution: ${Object.entries(kinds).map(([k, v]) => `${k}=${v}`).join(', ')}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
