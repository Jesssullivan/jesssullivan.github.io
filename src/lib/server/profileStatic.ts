// Server-only (prerender) access to the build-time profile.v1 copy. The JSON
// is parsed and validated here so a bad copy fails the build, and only the
// rendered slice (ProfileView) is serialized into the page; the client
// bundle never carries the file.
import raw from '../../../static/profile/v2/profile.v1.json';
import { parseProfileV1 } from '$lib/profile/schema';
import { toProfileView, type ProfileView } from '$lib/profile/view';

let cached: ProfileView | undefined;

export function staticProfileView(): ProfileView {
	cached ??= toProfileView(parseProfileV1(raw));
	return cached;
}
