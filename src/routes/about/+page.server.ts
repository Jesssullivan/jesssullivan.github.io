import { staticProfileView } from '$lib/server/profileStatic';
import type { PageServerLoad } from './$types';

// The v2 project map, upstream ribbon and activity rhythm read the build-time
// profile.v1 copy first; the browser then refreshes from the live host.
export const load: PageServerLoad = () => ({ profile: staticProfileView() });
