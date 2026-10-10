// Node module-resolution hook for tools that still need the classic
// TypeScript JavaScript API while `typescript` is 7.x (RU13, 2026-10-08).
//
// typescript-eslint 8.x requires `typescript` from about 100 compiled modules
// and peers `typescript <6.1.0`. TypeScript 7 exports only `version` from its
// entry point, so a per-file patch would not be minimal. This hook redirects
// `typescript` (and `typescript/...` subpaths) to the TypeScript team's
// `@typescript/typescript6` API package, only for importers inside
// typescript-eslint, @typescript-eslint/* and ts-api-utils. Every other
// importer still gets TypeScript 7. See patches/upstream/typescript-eslint.md.
//
// Usage: node --import ./scripts/typescript6-api-hook.mjs <tool> ...
import { registerHooks } from 'node:module';

const API_CONSUMERS =
	/[\\/]node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(?:typescript-eslint|@typescript-eslint[\\/][^\\/]+|ts-api-utils)[\\/]/;

registerHooks({
	resolve(specifier, context, nextResolve) {
		if (
			(specifier === 'typescript' || specifier.startsWith('typescript/')) &&
			context.parentURL &&
			API_CONSUMERS.test(decodeURIComponent(context.parentURL))
		) {
			return nextResolve(`@typescript/typescript6${specifier.slice('typescript'.length)}`, context);
		}
		return nextResolve(specifier, context);
	},
});
