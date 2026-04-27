// Pluggable id generator. The seeded variant is what tests use to produce
// stable event IDs across runs without relying on random or time-based ids.

export interface IdGenerator {
	next(prefix: string): string;
}

export const seededIdGenerator = (seed = 0): IdGenerator => {
	let counter = seed;
	return {
		next: (prefix) => `${prefix}_${++counter}`,
	};
};
