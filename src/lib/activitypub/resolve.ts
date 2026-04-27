import type {
	AS2Activity,
	AS2OrderedCollection,
	ActivityKind,
	BirdSightingData,
	BikeRideData,
	CodeActivityData,
	SensorReadingData,
	ResolvedActivity,
} from './types';

export function stripHtml(html: string): string {
	return html
		.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
		.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
		.replace(/<[^>]*>/g, '')
		.trim();
}

function formatBirdSummary(data: BirdSightingData): string {
	const count = data.count && data.count > 1 ? `${data.count}x ` : '';
	const where = data.location?.name ? ` at ${data.location.name}` : '';
	return `${count}${data.species}${where}`;
}

function formatBikeSummary(data: BikeRideData): string {
	const route = data.route ? ` on ${data.route}` : '';
	return `${data.distanceMiles.toFixed(1)} mi${route}`;
}

function formatCodeSummary(data: CodeActivityData): string {
	const net = data.linesAdded - data.linesRemoved;
	const sign = net >= 0 ? '+' : '';
	return `${sign}${net} lines across ${data.commits} commit${data.commits === 1 ? '' : 's'} in ${data.repository}`;
}

function formatSensorSummary(data: SensorReadingData): string {
	return data.measurements.map((m) => `${m.name}: ${m.value}${m.unit}`).join(', ');
}

function detectKind(activity: AS2Activity): {
	kind: ActivityKind;
	bird?: BirdSightingData;
	bike?: BikeRideData;
	code?: CodeActivityData;
	sensor?: SensorReadingData;
} {
	const obj = activity.object;
	if (obj['tl:birdSighting']) return { kind: 'bird', bird: obj['tl:birdSighting'] };
	if (obj['tl:bikeRide']) return { kind: 'bike', bike: obj['tl:bikeRide'] };
	if (obj['tl:codeActivity']) return { kind: 'code', code: obj['tl:codeActivity'] };
	if (obj['tl:sensorReading']) return { kind: 'sensor', sensor: obj['tl:sensorReading'] };
	return { kind: 'note' };
}

function summarize(kind: ActivityKind, resolved: ReturnType<typeof detectKind>, content: string): string {
	switch (kind) {
		case 'bird':
			return formatBirdSummary(resolved.bird!);
		case 'bike':
			return formatBikeSummary(resolved.bike!);
		case 'code':
			return formatCodeSummary(resolved.code!);
		case 'sensor':
			return formatSensorSummary(resolved.sensor!);
		default:
			return stripHtml(content).slice(0, 140);
	}
}

export function resolveActivity(activity: AS2Activity): ResolvedActivity {
	const obj = activity.object;
	const tags = (obj.tag ?? []).filter((t) => t.type === 'Hashtag').map((t) => t.name.replace(/^#/, ''));
	const resolved = detectKind(activity);
	const content = stripHtml(obj.content ?? '');

	return {
		id: activity.id,
		kind: resolved.kind,
		published: new Date(activity.published),
		content,
		summary: summarize(resolved.kind, resolved, content),
		tags,
		raw: activity,
		bird: resolved.bird,
		bike: resolved.bike,
		code: resolved.code,
		sensor: resolved.sensor,
	};
}

export function resolveOutbox(collection: AS2OrderedCollection): ResolvedActivity[] {
	return collection.orderedItems.map(resolveActivity);
}
