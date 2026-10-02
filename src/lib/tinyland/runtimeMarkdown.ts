import { renderReviewedComponentsForRuntime } from './reviewedComponents';

const BROKER_CODE_LANGUAGES = [
	'javascript', 'typescript', 'python', 'r', 'bash', 'html', 'css', 'json',
	'yaml', 'toml', 'haskell', 'go', 'rust', 'markdown', 'shellscript',
	'sql', 'nix', 'c', 'cpp', 'zig', 'swift',
] as const;

const LANGUAGE_ALIASES: Record<string, (typeof BROKER_CODE_LANGUAGES)[number]> = {
	js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', shell: 'shellscript',
	yml: 'yaml', md: 'markdown', rs: 'rust', cxx: 'cpp',
};

export function brokerCodeLanguage(info: string | undefined): (typeof BROKER_CODE_LANGUAGES)[number] | null {
	const requested = info?.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? '';
	const language = LANGUAGE_ALIASES[requested] ?? requested;
	return BROKER_CODE_LANGUAGES.find((candidate) => candidate === language) ?? null;
}

export function hasHighlightableBrokerFence(markdown: string): boolean {
	return [...markdown.matchAll(/^ {0,3}```([^\n]*)$/gm)]
		.some((match) => brokerCodeLanguage(match[1]) !== null);
}

function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type BrokerHighlighter = Awaited<ReturnType<typeof import('shiki')['createHighlighter']>>;
let highlighterPromise: Promise<BrokerHighlighter> | undefined;

function getBrokerHighlighter(): Promise<BrokerHighlighter> {
	return highlighterPromise ??= import('shiki')
		.then(({ createHighlighter }) => createHighlighter({ themes: ['github-dark'], langs: [...BROKER_CODE_LANGUAGES] }))
		.catch((error: unknown) => {
			highlighterPromise = undefined;
			throw error;
		});
}

export async function renderTrustedBrokerMarkdown(markdown: string): Promise<string> {
	if (typeof window === 'undefined') {
		throw new Error('runtime broker markdown rendering is browser-only');
	}

	const [markedModule, domPurifyModule] = await Promise.all([import('marked'), import('dompurify')]);
	const reviewedMarkdown = renderReviewedComponentsForRuntime(markdown);
	// The full broker body is display data. Match the checked-in post's Shiki
	// presentation for known fences without compiling supplied Svelte or HTML.
	// Unsupported languages (including Mermaid, whose static SVG needs a
	// reviewed build cache) remain readable escaped source.
	const highlighter = hasHighlightableBrokerFence(reviewedMarkdown)
		? await getBrokerHighlighter().catch(() => null)
		: null;
	const renderer = new markedModule.Renderer();
	renderer.code = (code: string, info?: string): string => {
		const language = brokerCodeLanguage(info);
		if (language && highlighter) {
			return highlighter.codeToHtml(code, { lang: language, theme: 'github-dark' });
		}
		return `<pre><code>${escapeHtml(code)}</code></pre>`;
	};
	const rendered = await markedModule.marked.parse(reviewedMarkdown, {
		gfm: true,
		breaks: false,
		renderer,
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
