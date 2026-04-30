import type { ProjectionResult } from '../broker/projection.js';
import type { PublicPulseItem } from '../schema/snapshot.js';

export const ACTIVITYPUB_DEMO_SCHEMA_VERSION = 'tinyland.pulse.v1.ActivityPubDemoPublication';
export const ACTIVITYSTREAMS_CONTEXT = 'https://www.w3.org/ns/activitystreams';
export const ACTIVITYSTREAMS_PUBLIC = 'https://www.w3.org/ns/activitystreams#Public';

export interface ActivityPubDemoDenial {
	readonly eventId: string;
	readonly reason: string;
	readonly detail: string;
}

export interface ActivityPubDemoActor {
	readonly id: string;
	readonly type: 'Person' | 'Service' | 'Application';
	readonly preferredUsername?: string;
	readonly name?: string;
	readonly url?: string;
}

export interface ActivityPubDemoTag {
	readonly type: 'Hashtag';
	readonly name: string;
}

export interface ActivityPubDemoAttachment {
	readonly type: 'PropertyValue';
	readonly name: string;
	readonly value: string;
}

export interface ActivityPubDemoNoteObject {
	readonly id: string;
	readonly type: 'Note';
	readonly attributedTo: string;
	readonly published: string;
	readonly summary: string;
	readonly content: string;
	readonly to: readonly string[];
	readonly tag?: readonly ActivityPubDemoTag[];
	readonly attachment?: readonly ActivityPubDemoAttachment[];
}

export interface ActivityPubDemoCreateActivity {
	readonly id: string;
	readonly type: 'Create';
	readonly actor: string;
	readonly published: string;
	readonly to: readonly string[];
	readonly object: ActivityPubDemoNoteObject;
}

export interface ActivityPubDemoOutbox {
	readonly '@context': typeof ACTIVITYSTREAMS_CONTEXT;
	readonly id: string;
	readonly type: 'OrderedCollection';
	readonly totalItems: number;
	readonly orderedItems: readonly ActivityPubDemoCreateActivity[];
}

export interface ActivityPubDemoPublishedQueueItem {
	readonly id: string;
	readonly sourceEventId: string;
	readonly state: 'published';
	readonly activity: ActivityPubDemoCreateActivity;
}

export interface ActivityPubDemoBlockedQueueItem {
	readonly id: string;
	readonly sourceEventId: string;
	readonly state: 'blocked';
	readonly reason: string;
	readonly detail: string;
}

export type ActivityPubDemoQueueItem = ActivityPubDemoPublishedQueueItem | ActivityPubDemoBlockedQueueItem;

export interface ActivityPubDemoPublicationInput {
	readonly items: readonly PublicPulseItem[];
	readonly denied?: readonly ActivityPubDemoDenial[];
	readonly generatedAt: string;
	readonly sourceSnapshotId: string;
}

export interface ActivityPubDemoPublisherOptions {
	readonly baseUrl?: string;
	readonly outboxId?: string;
	readonly actor?: ActivityPubDemoActor;
	readonly actorId?: string;
	readonly actorName?: string;
	readonly preferredUsername?: string;
}

export interface ActivityPubDemoPublishResult {
	readonly schemaVersion: typeof ACTIVITYPUB_DEMO_SCHEMA_VERSION;
	readonly generatedAt: string;
	readonly sourceSnapshotId: string;
	readonly actor: ActivityPubDemoActor;
	readonly queue: readonly ActivityPubDemoQueueItem[];
	readonly outbox: ActivityPubDemoOutbox;
	readonly denied: readonly ActivityPubDemoDenial[];
}

const DEFAULT_BASE_URL = 'https://jesssullivan.github.io/pulse/ap-demo';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const idPart = (value: string): string => encodeURIComponent(value);

const normalizeTag = (tag: string): ActivityPubDemoTag => ({
	type: 'Hashtag',
	name: tag.startsWith('#') ? tag : `#${tag}`,
});

const birdAttachments = (item: PublicPulseItem): readonly ActivityPubDemoAttachment[] => {
	if (!item.birdSighting) return [];
	const sighting = item.birdSighting;
	const attachments: ActivityPubDemoAttachment[] = [
		{ type: 'PropertyValue', name: 'Common name', value: sighting.commonName },
		{ type: 'PropertyValue', name: 'Scientific name', value: sighting.scientificName },
		{ type: 'PropertyValue', name: 'Count', value: String(sighting.count) },
		{ type: 'PropertyValue', name: 'Place', value: sighting.placeLabel },
	];
	return attachments.filter((entry) => entry.value.trim().length > 0);
};

const sortPublicItems = (items: readonly PublicPulseItem[]): readonly PublicPulseItem[] =>
	[...items].sort((a, b) => {
		if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
		return a.id < b.id ? -1 : 1;
	});

const resolveActor = (options: ActivityPubDemoPublisherOptions, baseUrl: string): ActivityPubDemoActor => {
	const actor = options.actor;
	if (actor) return actor;
	const preferredUsername = options.preferredUsername ?? 'jess';
	const id = options.actorId ?? `${baseUrl}/actors/${idPart(preferredUsername)}`;
	return {
		id,
		type: 'Person',
		preferredUsername,
		name: options.actorName ?? 'Jess Sullivan',
		url: 'https://jesssullivan.github.io/',
	};
};

export const projectPublicPulseItemToActivity = (
	item: PublicPulseItem,
	options: ActivityPubDemoPublisherOptions = {},
): ActivityPubDemoCreateActivity => {
	const baseUrl = trimTrailingSlash(options.baseUrl ?? DEFAULT_BASE_URL);
	const actor = resolveActor(options, baseUrl);
	const tags = item.tags.map(normalizeTag);
	const attachments = birdAttachments(item);
	const object: ActivityPubDemoNoteObject = {
		id: `${baseUrl}/objects/${idPart(item.id)}`,
		type: 'Note',
		attributedTo: actor.id,
		published: item.occurredAt,
		summary: item.summary,
		content: item.kind === 'bird_sighting' ? item.summary : item.content,
		to: [ACTIVITYSTREAMS_PUBLIC],
		...(tags.length > 0 ? { tag: tags } : {}),
		...(attachments.length > 0 ? { attachment: attachments } : {}),
	};
	return {
		id: `${baseUrl}/activities/${idPart(item.id)}/create`,
		type: 'Create',
		actor: actor.id,
		published: item.occurredAt,
		to: [ACTIVITYSTREAMS_PUBLIC],
		object,
	};
};

export const publishPublicPulseItemsToActivityPubDemo = (
	input: ActivityPubDemoPublicationInput,
	options: ActivityPubDemoPublisherOptions = {},
): ActivityPubDemoPublishResult => {
	const baseUrl = trimTrailingSlash(options.baseUrl ?? DEFAULT_BASE_URL);
	const actor = resolveActor(options, baseUrl);
	const activityOptions: ActivityPubDemoPublisherOptions = {
		...options,
		baseUrl,
		actor,
	};
	const published: ActivityPubDemoPublishedQueueItem[] = sortPublicItems(input.items).map((item) => {
		const activity = projectPublicPulseItemToActivity(item, activityOptions);
		return {
			id: `${baseUrl}/queue/${idPart(item.id)}`,
			sourceEventId: item.id,
			state: 'published',
			activity,
		};
	});
	const blocked: ActivityPubDemoBlockedQueueItem[] = (input.denied ?? []).map((denial) => ({
		id: `${baseUrl}/queue/blocked/${idPart(denial.eventId)}`,
		sourceEventId: denial.eventId,
		state: 'blocked',
		reason: denial.reason,
		detail: denial.detail,
	}));
	const orderedItems = published.map((item) => item.activity);
	const outbox: ActivityPubDemoOutbox = {
		'@context': ACTIVITYSTREAMS_CONTEXT,
		id: options.outboxId ?? `${trimTrailingSlash(actor.id)}/outbox`,
		type: 'OrderedCollection',
		totalItems: orderedItems.length,
		orderedItems,
	};
	return {
		schemaVersion: ACTIVITYPUB_DEMO_SCHEMA_VERSION,
		generatedAt: input.generatedAt,
		sourceSnapshotId: input.sourceSnapshotId,
		actor,
		queue: [...published, ...blocked],
		outbox,
		denied: input.denied ?? [],
	};
};

export const publishProjectionToActivityPubDemo = (
	projection: ProjectionResult,
	options: ActivityPubDemoPublisherOptions = {},
): ActivityPubDemoPublishResult =>
	publishPublicPulseItemsToActivityPubDemo(
		{
			items: projection.snapshot.items,
			denied: projection.denied,
			generatedAt: projection.snapshot.generatedAt,
			sourceSnapshotId: projection.snapshot.manifest.sourceSnapshotId,
		},
		options,
	);
