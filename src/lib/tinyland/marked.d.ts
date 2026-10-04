declare module 'marked' {
	export class Renderer {
		code(code: string, info?: string, escaped?: boolean): string;
	}

	export const marked: {
		parse(markdown: string, options?: Record<string, unknown>): string | Promise<string>;
	};
}
