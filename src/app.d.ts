// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	// Public build SHA injected by Vite `define` (see vite.config.ts). Empty
	// string when no real build sha is present.
	const __BUILD_SHA__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
