import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
	applyPolicyToEvent,
	M1_PUBLIC_PAYLOAD_KINDS,
	type PulseEvent,
	type Visibility,
	type LocationPrecision,
	type PayloadKind,
} from '../src/index.js';
import {
	FIXTURE_NOTES,
	FIXTURE_BIRDS,
	FIXTURE_DISALLOWED,
} from '../src/fixtures/index.js';

const VISIBILITIES: readonly Visibility[] = [
	'VISIBILITY_UNSPECIFIED',
	'VISIBILITY_PRIVATE',
	'VISIBILITY_UNLISTED',
	'VISIBILITY_PUBLIC',
];

const PRECISIONS: readonly LocationPrecision[] = [
	'LOCATION_PRECISION_UNSPECIFIED',
	'LOCATION_PRECISION_HIDDEN',
	'LOCATION_PRECISION_REGION',
	'LOCATION_PRECISION_EXACT',
];

const ALL_KINDS: readonly PayloadKind[] = [
	'note',
	'bird_sighting',
	'photo',
	'git_summary',
	'listening',
];

const arbVisibility = fc.constantFrom(...VISIBILITIES);
const arbPrecision = fc.constantFrom(...PRECISIONS);
const arbKind = fc.constantFrom(...ALL_KINDS);

const arbIsoTimestamp = fc.date({ noInvalidDate: true }).map((d) => d.toISOString());

const arbMedia = fc.array(
	fc.record({
		id: fc.string({ minLength: 1, maxLength: 8 }),
		mimeType: fc.constantFrom('image/jpeg', 'image/png'),
		altText: fc.string({ maxLength: 32 }),
		privateObjectKey: fc.constantFrom('', 's3://private/photos/x.jpg'),
		publicUrl: fc.constantFrom('', 'https://cdn.example/photo.jpg'),
	}),
	{ maxLength: 2 },
);

const arbPayload = (kind: PayloadKind) => {
	switch (kind) {
		case 'note':
			return fc.record({
				kind: fc.constant('note' as const),
				text: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
			});
		case 'bird_sighting':
			return fc.record({
				kind: fc.constant('bird_sighting' as const),
				commonName: fc.string({ minLength: 1, maxLength: 32 }),
				scientificName: fc.string({ maxLength: 32 }),
				count: fc.integer({ min: 1, max: 50 }),
				place: fc.option(
					fc.record({
						label: fc.string({ minLength: 1, maxLength: 32 }),
						latitude: fc.double({ min: -90, max: 90, noNaN: true }),
						longitude: fc.double({ min: -180, max: 180, noNaN: true }),
						precision: arbPrecision,
					}),
					{ nil: undefined },
				),
				observationId: fc.string({ minLength: 1, maxLength: 8 }),
			});
		case 'photo':
			return fc.record({
				kind: fc.constant('photo' as const),
				caption: fc.string({ maxLength: 32 }),
			});
		case 'git_summary':
			return fc.record({
				kind: fc.constant('git_summary' as const),
				repository: fc.string({ minLength: 1, maxLength: 24 }),
				summary: fc.string({ minLength: 1, maxLength: 64 }),
			});
		case 'listening':
			return fc.record({
				kind: fc.constant('listening' as const),
				title: fc.string({ minLength: 1, maxLength: 32 }),
				artist: fc.string({ maxLength: 32 }),
				album: fc.string({ maxLength: 32 }),
				externalUrl: fc.string({ maxLength: 64 }),
			});
	}
};

const arbEvent: fc.Arbitrary<PulseEvent> = arbKind.chain((kind) =>
	fc.record({
		id: fc.string({ minLength: 1, maxLength: 16 }),
		actor: fc.string({ minLength: 1, maxLength: 8 }),
		occurredAt: arbIsoTimestamp,
		visibility: arbVisibility,
		source: fc.record({
			client: fc.string({ minLength: 1, maxLength: 8 }),
			deviceId: fc.string({ maxLength: 8 }),
			idempotencyKey: fc.string({ minLength: 1, maxLength: 16 }),
		}),
		tags: fc.array(fc.string({ minLength: 1, maxLength: 8 }), { maxLength: 4 }),
		media: arbMedia,
		revision: fc.integer({ min: 1, max: 5 }),
		payload: arbPayload(kind),
	}),
) as fc.Arbitrary<PulseEvent>;

describe('policy/applyPolicyToEvent (deterministic fixtures)', () => {
	it.each(FIXTURE_NOTES.filter((e) => e.visibility === 'VISIBILITY_PUBLIC'))(
		'allows public note fixture %s',
		(event) => {
			const decision = applyPolicyToEvent(event);
			expect(decision.allowed).toBe(true);
			if (decision.allowed) expect(decision.item.kind).toBe('note');
		},
	);

	it.each(FIXTURE_NOTES.filter((e) => e.visibility !== 'VISIBILITY_PUBLIC'))(
		'denies non-public note fixture %s',
		(event) => {
			const decision = applyPolicyToEvent(event);
			expect(decision.allowed).toBe(false);
			if (!decision.allowed) expect(decision.reason).toBe('visibility_not_public');
		},
	);

	it('denies the exact-location bird fixture by default', () => {
		const exact = FIXTURE_BIRDS.find((e) =>
			e.payload.kind === 'bird_sighting' && e.payload.place?.precision === 'LOCATION_PRECISION_EXACT',
		)!;
		const decision = applyPolicyToEvent(exact);
		expect(decision.allowed).toBe(false);
		if (!decision.allowed) expect(decision.reason).toBe('exact_location_not_allowlisted');
	});

	it('allows the exact-location bird fixture when allowExactLocation=true', () => {
		const exact = FIXTURE_BIRDS.find((e) =>
			e.payload.kind === 'bird_sighting' && e.payload.place?.precision === 'LOCATION_PRECISION_EXACT',
		)!;
		const decision = applyPolicyToEvent(exact, { allowExactLocation: true });
		expect(decision.allowed).toBe(true);
	});

	it.each(FIXTURE_DISALLOWED)(
		'denies disallowed fixture %s',
		(event) => {
			const decision = applyPolicyToEvent(event);
			expect(decision.allowed).toBe(false);
		},
	);
});

describe('policy/applyPolicyToEvent (invariants)', () => {
	it('non-public visibility is always denied', () => {
		fc.assert(
			fc.property(arbEvent, (event) => {
				if (event.visibility === 'VISIBILITY_PUBLIC') return true;
				const decision = applyPolicyToEvent(event);
				return decision.allowed === false;
			}),
			{ numRuns: 200 },
		);
	});

	it('non-M1 payload kinds are always denied even when public', () => {
		const allowed = new Set<string>(M1_PUBLIC_PAYLOAD_KINDS);
		fc.assert(
			fc.property(arbEvent, (event) => {
				if (event.visibility !== 'VISIBILITY_PUBLIC') return true;
				if (allowed.has(event.payload.kind)) return true;
				const decision = applyPolicyToEvent(event);
				return decision.allowed === false && decision.reason === 'kind_not_in_m1_allowlist';
			}),
			{ numRuns: 200 },
		);
	});

	it('any non-empty privateObjectKey blocks projection', () => {
		fc.assert(
			fc.property(arbEvent, (event) => {
				if (event.visibility !== 'VISIBILITY_PUBLIC') return true;
				if (!allowedKindForM1(event)) return true;
				const hasPrivate = event.media.some((m) => m.privateObjectKey.length > 0);
				if (!hasPrivate) return true;
				const decision = applyPolicyToEvent(event);
				return decision.allowed === false && decision.reason === 'private_object_key_present';
			}),
			{ numRuns: 200 },
		);
	});

	it('exact location is always denied without explicit allowlist', () => {
		fc.assert(
			fc.property(arbEvent, (event) => {
				if (event.visibility !== 'VISIBILITY_PUBLIC') return true;
				if (event.payload.kind !== 'bird_sighting') return true;
				if (event.media.some((m) => m.privateObjectKey.length > 0)) return true;
				if (event.payload.place?.precision !== 'LOCATION_PRECISION_EXACT') return true;
				const decision = applyPolicyToEvent(event);
				return decision.allowed === false && decision.reason === 'exact_location_not_allowlisted';
			}),
			{ numRuns: 200 },
		);
	});

	it('an allowed projection never carries a privateObjectKey or exact coordinates', () => {
		fc.assert(
			fc.property(arbEvent, (event) => {
				const decision = applyPolicyToEvent(event);
				if (!decision.allowed) return true;
				const item = decision.item;
				const itemJson = JSON.stringify(item);
				if (itemJson.includes('privateObjectKey')) return false;
				if (itemJson.includes('s3://')) return false;
				return true;
			}),
			{ numRuns: 200 },
		);
	});
});

const allowedKindForM1 = (event: PulseEvent): boolean =>
	(M1_PUBLIC_PAYLOAD_KINDS as readonly string[]).includes(event.payload.kind);
