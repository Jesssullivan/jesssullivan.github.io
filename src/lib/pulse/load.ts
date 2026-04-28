import { PublicPulseSnapshotSchema, type PublicPulseSnapshot } from '@blog/pulse-core/schema';

export const PUBLIC_SNAPSHOT_PATH = '/data/pulse/public-snapshot.v1.json';

export async function loadPulseSnapshot(fetchFn: typeof fetch): Promise<PublicPulseSnapshot> {
	const res = await fetchFn(PUBLIC_SNAPSHOT_PATH);
	if (!res.ok) {
		throw new Error(`pulse snapshot fetch failed: ${res.status} ${res.statusText} (${PUBLIC_SNAPSHOT_PATH})`);
	}
	const data: unknown = await res.json();
	const result = PublicPulseSnapshotSchema.safeParse(data);
	if (!result.success) {
		throw new Error(`pulse snapshot failed schema validation: ${result.error.issues.map((i) => i.message).join('; ')}`);
	}
	return result.data;
}
