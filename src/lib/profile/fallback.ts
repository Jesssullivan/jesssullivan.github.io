import snapshotSource from '../../../static/profile/profile.v1.json?raw';
import { parseProfileV1 } from './schema';

/** Validated at build/SSR; this is a real producer snapshot, never sample activity. */
export const profileFallback = parseProfileV1(JSON.parse(snapshotSource));
