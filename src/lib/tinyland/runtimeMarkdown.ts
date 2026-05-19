export async function renderTrustedBrokerMarkdown(markdown: string): Promise<string> {
	if (typeof window === 'undefined') {
		throw new Error('runtime broker markdown rendering is browser-only');
	}

	const [markedModule, domPurifyModule] = await Promise.all([import('marked'), import('dompurify')]);
	const rendered = await markedModule.marked.parse(markdown, {
		gfm: true,
		breaks: false,
	});
	const domPurify = domPurifyModule.default as unknown as
		| { sanitize: (value: string, config?: Record<string, unknown>) => string }
		| ((window: Window) => { sanitize: (value: string, config?: Record<string, unknown>) => string });
	const purifier =
		typeof (domPurify as { sanitize?: unknown }).sanitize === 'function'
			? (domPurify as { sanitize: (value: string, config?: Record<string, unknown>) => string })
			: (domPurify as (window: Window) => {
					sanitize: (value: string, config?: Record<string, unknown>) => string;
				})(window);

	return purifier.sanitize(rendered, {
		USE_PROFILES: { html: true },
		ADD_ATTR: ['target', 'rel'],
	});
}
