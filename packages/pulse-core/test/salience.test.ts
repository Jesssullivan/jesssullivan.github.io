import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
	PulseEventSchema,
	PublicPulseItemSchema,
	SalienceSchema,
	salienceRank,
	applyPolicyToEvent,
	projectAcceptedEvents,
	type PulseEvent,
	type Salience,
	type ProjectionOptions,
} from '../src/index.js';
import { FIXTURE_NOTES, FIXTURE_BIRDS, FIXTURE_DISALLOWED } from '../src/fixtures/index.js';

const OPTS: ProjectionOptions = {
	generatedAt: '2026-05-10T00:00:00.000Z',
	sourceSnapshotId: 'salience-test',
};

// Build a deterministic public note event. Salience is only attached when
// provided, so untiered events never carry a `salience` own-key (mirrors how
// the schema and policy treat absence).
const makeNote = (id: string, occurredAt: string, salience?: Salience): PulseEvent => ({
	id,
	actor: 'jess',
	occurredAt,
	visibility: 'VISIBILITY_PUBLIC',
	source: { client: 'salience-test', deviceId: 'd', idempotencyKey: `idem_${id}` },
	tags: [],
	media: [],
	revision: 1,
	payload: { kind: 'note', text: `note ${id}` },
	...(salience === undefined ? {} : { salience }),
});

// Deterministic seeded shuffle so input-order-independence can be exercised
// without pulling in randomness that would make the property flaky.
const shuffle = <T>(input: readonly T[], seed: number): T[] => {
	const out = [...input];
	let s = (seed ^ 0x9e3779b9) >>> 0;
	const rand = () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		const tmp = out[i]!;
		out[i] = out[j]!;
		out[j] = tmp;
	}
	return out;
};

const arbSalience = fc.option(fc.constantFrom<Salience>('less-noteworthy', 'noteworthy'), {
	nil: undefined,
});

const arbNoteSpec = fc.record({
	occurredAt: fc.constantFrom(
		'2026-05-01T00:00:00.000Z',
		'2026-05-02T00:00:00.000Z',
		'2026-05-03T00:00:00.000Z',
	),
	salience: arbSalience,
});

const eventsFromSpecs = (specs: readonly { occurredAt: string; salience?: Salience }[]): PulseEvent[] =>
	specs.map((s, i) => makeNote(`evt_${String(i).padStart(3, '0')}`, s.occurredAt, s.salience));

describe('schema/salience', () => {
	it('accepts an event with no salience (backward compatible)', () => {
		const parsed = PulseEventSchema.safeParse(FIXTURE_NOTES[0]);
		expect(parsed.success).toBe(true);
		if (parsed.success) {
			expect(Object.prototype.hasOwnProperty.call(parsed.data, 'salience')).toBe(false);
		}
	});

	it.each(['less-noteworthy', 'noteworthy'] as const)('accepts salience=%s', (salience) => {
		const parsed = PulseEventSchema.safeParse(makeNote('evt_a', '2026-05-01T00:00:00.000Z', salience));
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.salience).toBe(salience);
	});

	it('rejects an unknown salience value', () => {
		const broken = { ...makeNote('evt_a', '2026-05-01T00:00:00.000Z'), salience: 'super-noteworthy' };
		expect(PulseEventSchema.safeParse(broken).success).toBe(false);
	});

	it('the enum has exactly the two ranked tiers (absence is untiered, not a value)', () => {
		expect(SalienceSchema.safeParse('less-noteworthy').success).toBe(true);
		expect(SalienceSchema.safeParse('noteworthy').success).toBe(true);
		expect(SalienceSchema.safeParse('untiered').success).toBe(false);
		expect(SalienceSchema.safeParse('pulse').success).toBe(false);
	});

	it('salienceRank orders noteworthy > less-noteworthy > untiered', () => {
		expect(salienceRank('noteworthy')).toBeGreaterThan(salienceRank('less-noteworthy'));
		expect(salienceRank('less-noteworthy')).toBeGreaterThan(salienceRank(undefined));
	});

	it('a public item may omit or carry salience', () => {
		const base = {
			id: 'x',
			kind: 'note' as const,
			occurredAt: '2026-05-01T00:00:00.000Z',
			summary: 's',
			content: 's',
			tags: [],
		};
		expect(PublicPulseItemSchema.safeParse(base).success).toBe(true);
		expect(PublicPulseItemSchema.safeParse({ ...base, salience: 'noteworthy' }).success).toBe(true);
		expect(PublicPulseItemSchema.safeParse({ ...base, salience: 'nope' }).success).toBe(false);
	});
});

describe('policy/salience passthrough', () => {
	it('carries salience onto the projected item', () => {
		const decision = applyPolicyToEvent(makeNote('evt_a', '2026-05-01T00:00:00.000Z', 'noteworthy'));
		expect(decision.allowed).toBe(true);
		if (decision.allowed) expect(decision.item.salience).toBe('noteworthy');
	});

	it('omits salience when the source event is untiered', () => {
		const decision = applyPolicyToEvent(makeNote('evt_a', '2026-05-01T00:00:00.000Z'));
		expect(decision.allowed).toBe(true);
		if (decision.allowed) {
			expect(Object.prototype.hasOwnProperty.call(decision.item, 'salience')).toBe(false);
		}
	});

	it('salience never changes the allow/deny decision', () => {
		const ALL_FIXTURES = [...FIXTURE_NOTES, ...FIXTURE_BIRDS, ...FIXTURE_DISALLOWED];
		fc.assert(
			fc.property(fc.constantFrom(...ALL_FIXTURES), arbSalience, (base, salience) => {
				const stripped: PulseEvent = { ...base };
				delete (stripped as { salience?: Salience }).salience;
				const withSal: PulseEvent = salience === undefined ? stripped : { ...stripped, salience };
				const a = applyPolicyToEvent(stripped);
				const b = applyPolicyToEvent(withSal);
				if (a.allowed !== b.allowed) return false;
				if (!a.allowed && !b.allowed) return a.reason === b.reason;
				return true;
			}),
			{ numRuns: 200 },
		);
	});
});

describe('projection/salience ordering', () => {
	it('orders noteworthy before less-noteworthy before untiered within an equal timestamp', () => {
		const ts = '2026-05-01T00:00:00.000Z';
		const events = [
			makeNote('evt_untiered', ts),
			makeNote('evt_note', ts, 'noteworthy'),
			makeNote('evt_less', ts, 'less-noteworthy'),
		];
		const { snapshot } = projectAcceptedEvents(events, OPTS);
		expect(snapshot.items.map((i) => i.id)).toEqual(['evt_note', 'evt_less', 'evt_untiered']);
	});

	it('salience only reorders within an equal-occurredAt group (newer untiered still leads older noteworthy)', () => {
		const newerUntiered = makeNote('evt_new', '2026-05-02T00:00:00.000Z');
		const olderNoteworthy = makeNote('evt_old', '2026-05-01T00:00:00.000Z', 'noteworthy');
		const { snapshot } = projectAcceptedEvents([olderNoteworthy, newerUntiered], OPTS);
		expect(snapshot.items.map((i) => i.id)).toEqual(['evt_new', 'evt_old']);
	});

	it('id ascending stays the final tiebreak within equal timestamp+salience', () => {
		const ts = '2026-05-01T00:00:00.000Z';
		const events = [
			makeNote('evt_z', ts, 'noteworthy'),
			makeNote('evt_a', ts, 'noteworthy'),
		];
		const { snapshot } = projectAcceptedEvents(events, OPTS);
		expect(snapshot.items.map((i) => i.id)).toEqual(['evt_a', 'evt_z']);
	});

	it('projected items obey occurredAt-desc, salience-desc, id-asc for arbitrary inputs', () => {
		fc.assert(
			fc.property(fc.array(arbNoteSpec, { maxLength: 16 }), (specs) => {
				const { snapshot } = projectAcceptedEvents(eventsFromSpecs(specs), OPTS);
				for (let i = 1; i < snapshot.items.length; i++) {
					const prev = snapshot.items[i - 1]!;
					const curr = snapshot.items[i]!;
					if (prev.occurredAt < curr.occurredAt) return false;
					if (prev.occurredAt === curr.occurredAt) {
						const rp = salienceRank(prev.salience);
						const rc = salienceRank(curr.salience);
						if (rp < rc) return false;
						if (rp === rc && prev.id > curr.id) return false;
					}
				}
				return true;
			}),
			{ numRuns: 300 },
		);
	});

	it('ordering and content hash are independent of input order', () => {
		fc.assert(
			fc.property(
				fc.array(arbNoteSpec, { minLength: 1, maxLength: 12 }),
				fc.integer({ min: 0, max: 1_000_000 }),
				(specs, seed) => {
					const events = eventsFromSpecs(specs);
					const a = projectAcceptedEvents(events, OPTS);
					const b = projectAcceptedEvents(shuffle(events, seed), OPTS);
					const idsA = a.snapshot.items.map((i) => i.id);
					const idsB = b.snapshot.items.map((i) => i.id);
					return (
						a.snapshot.manifest.contentHash === b.snapshot.manifest.contentHash &&
						JSON.stringify(idsA) === JSON.stringify(idsB)
					);
				},
			),
			{ numRuns: 200 },
		);
	});
});

describe('projection/content-hash stability', () => {
	const untieredFixtures = [...FIXTURE_NOTES, ...FIXTURE_BIRDS];

	it('emits no salience key for untiered inputs (byte-stable serialization)', () => {
		const { snapshot } = projectAcceptedEvents(untieredFixtures, OPTS);
		expect(JSON.stringify(snapshot.items).includes('salience')).toBe(false);
		for (const item of snapshot.items) {
			expect(Object.prototype.hasOwnProperty.call(item, 'salience')).toBe(false);
		}
	});

	it('content hash is stable across input order for salience-free inputs', () => {
		const a = projectAcceptedEvents(untieredFixtures, OPTS);
		const b = projectAcceptedEvents([...untieredFixtures].reverse(), OPTS);
		expect(a.snapshot.manifest.contentHash).toBe(b.snapshot.manifest.contentHash);
	});

	it('locks the content hash for the untiered fixture projection', () => {
		// Verified byte-for-byte identical to the pre-salience baseline: adding
		// the optional field and the tie-break sort key must not perturb the hash
		// of inputs that carry no salience and no equal-timestamp collisions.
		const { snapshot } = projectAcceptedEvents(untieredFixtures, OPTS);
		expect(snapshot.manifest.contentHash).toBe(
			'sha256:cfd738c1310637187faa4a85ef5d7512531dd11b53ab9c7e8f9dc28dffebf094',
		);
	});

	it('a salience-bearing event changes the projected item but not the ordering of distinct-timestamp inputs', () => {
		const plain = eventsFromSpecs([
			{ occurredAt: '2026-05-02T00:00:00.000Z' },
			{ occurredAt: '2026-05-01T00:00:00.000Z' },
		]);
		const tiered = eventsFromSpecs([
			{ occurredAt: '2026-05-02T00:00:00.000Z', salience: 'noteworthy' },
			{ occurredAt: '2026-05-01T00:00:00.000Z', salience: 'less-noteworthy' },
		]);
		const a = projectAcceptedEvents(plain, OPTS);
		const b = projectAcceptedEvents(tiered, OPTS);
		// Same ids in the same order (timestamps are distinct)...
		expect(a.snapshot.items.map((i) => i.id)).toEqual(b.snapshot.items.map((i) => i.id));
		// ...but the tiered projection carries salience and thus a different hash.
		expect(b.snapshot.items[0]?.salience).toBe('noteworthy');
		expect(a.snapshot.manifest.contentHash).not.toBe(b.snapshot.manifest.contentHash);
	});
});
