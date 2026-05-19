declare module 'marked' {
	export const marked: {
		parse(markdown: string, options?: Record<string, unknown>): string | Promise<string>;
	};
}
