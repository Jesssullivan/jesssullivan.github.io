import { error } from '@sveltejs/kit';
import { ATTACHMENT_HEADER_RULES } from '$lib/server/notes';

// The response headers of the note attachments, for Cloudflare Pages
// (TIN-8654). A static host does not run the attachment route, so it never
// sees the headers that route returns. Pages reads the file _headers from
// the build output instead and applies each rule to the one file it names.
// The file holds one rule per attachment: its exact Content-Type,
// X-Content-Type-Options and a Content-Security-Policy that runs nothing.
//
// With no note attachment the route is not prerendered and no _headers file
// is written, so the build output is what it was before notes existed.
export const prerender = ATTACHMENT_HEADER_RULES !== null;

export function GET() {
	if (ATTACHMENT_HEADER_RULES === null) error(404, 'Not found');
	return new Response(ATTACHMENT_HEADER_RULES, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
