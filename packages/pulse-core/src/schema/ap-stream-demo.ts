import { z } from 'zod';
import { IsoTimestampSchema } from './event.js';

export const PULSE_AP_STREAM_DEMO_SCHEMA_VERSION = 'tinyland.pulse.ap-stream-demo.v1';
export const PULSE_AP_STREAM_DEMO_STATUS = 'controlled-static-source-live-broker-demo';

export const PulseApStreamDemoTagSchema = z
	.object({
		type: z.literal('Hashtag'),
		name: z.string().regex(/^#\S+$/),
	})
	.strict();

export type PulseApStreamDemoTag = z.infer<typeof PulseApStreamDemoTagSchema>;

export const PulseApStreamDemoItemSchema = z
	.object({
		id: z.string().url(),
		type: z.literal('Note'),
		published: IsoTimestampSchema,
		summary: z.string(),
		content: z.string(),
		tag: z.array(PulseApStreamDemoTagSchema),
		tinylandPulse: z
			.object({
				id: z.string().min(1),
				kind: z.string().min(1),
				sourceSnapshotId: z.string().min(1),
			})
			.strict(),
	})
	.strict();

export type PulseApStreamDemoItem = z.infer<typeof PulseApStreamDemoItemSchema>;

export const PulseApStreamDemoSchema = z
	.object({
		schemaVersion: z.literal(PULSE_AP_STREAM_DEMO_SCHEMA_VERSION),
		generatedAt: IsoTimestampSchema,
		sourceAuthority: z.literal('tinyland.dev'),
		sourceAuthorityUrl: z.literal('https://tinyland.dev'),
		sourceSnapshotId: z.string().min(1),
		contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
		policyVersion: z.string().min(1),
		projectionKind: z.literal('pulse-ap-stream-demo'),
		demoStatus: z.literal(PULSE_AP_STREAM_DEMO_STATUS),
		publicFediverseDelivery: z.literal(false),
		activityPubStatus: z.literal('ap-shaped-projection-only'),
		spokeRef: z.string().min(1),
		spokeTarget: z.string().min(1),
		routePath: z.string().regex(/^\/projections\/[^/]+\/pulse\/ap-stream-demo\.v1\.json$/),
		publicUrl: z.string().url(),
		itemCount: z.number().int().min(0),
		orderedItems: z.array(PulseApStreamDemoItemSchema),
	})
	.strict()
	.refine((demo) => demo.itemCount === demo.orderedItems.length, {
		message: 'itemCount must match orderedItems.length',
	})
	.refine((demo) => demo.publicUrl === `${demo.sourceAuthorityUrl}${demo.routePath}`, {
		message: 'publicUrl must match sourceAuthorityUrl + routePath',
	});

export type PulseApStreamDemo = z.infer<typeof PulseApStreamDemoSchema>;
