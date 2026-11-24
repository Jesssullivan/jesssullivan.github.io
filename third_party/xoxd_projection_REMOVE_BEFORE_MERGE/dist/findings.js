// Generated from src/ by tools/emit-js.ts. Edit the TypeScript source.
/**
 * Typed findings. The codes from fetch_missing to html_javascript_url are the
 * codes the contract README names, with the same meaning. The last five
 * belong to this module. They cover what a site build adds around the
 * contract: head.json, the dispatched seq, the base URL, a fetch that fails
 * with another status than 404, and writing the output directory.
 */

export const finding = (code                       , at        , detail        )                    => ({
	code,
	at,
	detail,
});

/** One line per finding, for logs and for the CLI. */
export function formatFinding(item                   )         {
	return `${item.code} at ${item.at}: ${item.detail}`;
}
