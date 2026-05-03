import type { Source } from '@blog/pulse-core/schema';

export interface PulseClientIdentity {
	readonly actor: string;
	readonly displayName: string;
	readonly deviceId: string;
	readonly deviceLabel: string;
	readonly client: string;
	readonly sessionId: string;
}

export const PULSE_CLIENT_DEFAULT_IDENTITY: PulseClientIdentity = {
	actor: 'jess',
	displayName: 'Jess Sullivan',
	deviceId: 'browser-local',
	deviceLabel: 'Browser local draft device',
	client: 'pulse-client-scaffold',
	sessionId: 'local-session-1',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

export const createPulseClientIdentity = (input: Partial<PulseClientIdentity> = {}): PulseClientIdentity => ({
	actor: input.actor ?? PULSE_CLIENT_DEFAULT_IDENTITY.actor,
	displayName: input.displayName ?? PULSE_CLIENT_DEFAULT_IDENTITY.displayName,
	deviceId: input.deviceId ?? PULSE_CLIENT_DEFAULT_IDENTITY.deviceId,
	deviceLabel: input.deviceLabel ?? PULSE_CLIENT_DEFAULT_IDENTITY.deviceLabel,
	client: input.client ?? PULSE_CLIENT_DEFAULT_IDENTITY.client,
	sessionId: input.sessionId ?? PULSE_CLIENT_DEFAULT_IDENTITY.sessionId,
});

export const normalizePulseClientIdentity = (identity: PulseClientIdentity): PulseClientIdentity => ({
	actor: identity.actor.trim(),
	displayName: identity.displayName.trim(),
	deviceId: identity.deviceId.trim(),
	deviceLabel: identity.deviceLabel.trim(),
	client: identity.client.trim(),
	sessionId: identity.sessionId.trim(),
});

export const summarizePulseClientIdentity = (identity: PulseClientIdentity): readonly string[] => {
	const normalized = normalizePulseClientIdentity(identity);
	const errors: string[] = [];

	if (normalized.actor.length === 0) errors.push('actor identity missing');
	if (normalized.displayName.length === 0) errors.push('display name missing');
	if (normalized.deviceId.length === 0) errors.push('device id missing');
	if (normalized.deviceLabel.length === 0) errors.push('device label missing');
	if (normalized.client.length === 0) errors.push('client id missing');
	if (normalized.sessionId.length === 0) errors.push('session id missing');

	return errors;
};

export const identityToPulseSource = (identity: PulseClientIdentity, idempotencyKey: string): Source => {
	const normalized = normalizePulseClientIdentity(identity);
	return {
		client: normalized.client,
		deviceId: normalized.deviceId,
		idempotencyKey,
	};
};

export const parsePulseClientIdentity = (value: unknown): PulseClientIdentity | null => {
	if (!isRecord(value)) return null;
	if (!isString(value.actor)) return null;
	if (!isString(value.displayName)) return null;
	if (!isString(value.deviceId)) return null;
	if (!isString(value.deviceLabel)) return null;
	if (!isString(value.client)) return null;
	if (!isString(value.sessionId)) return null;

	return createPulseClientIdentity({
		actor: value.actor,
		displayName: value.displayName,
		deviceId: value.deviceId,
		deviceLabel: value.deviceLabel,
		client: value.client,
		sessionId: value.sessionId,
	});
};
