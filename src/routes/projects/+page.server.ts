import { staticProfileView } from '$lib/server/profileStatic';
import type { PageServerLoad } from './$types';

// Prerendered from the build-time profile.v1 copy; the page then refreshes
// from the live host in the browser (src/lib/profile/load.ts).
export const load: PageServerLoad = () => ({ profile: staticProfileView() });
