/**
 * Typed findings. The codes from fetch_missing to html_javascript_url are the
 * codes the contract README names, with the same meaning. The last five
 * belong to this module. They cover what a site build adds around the
 * contract: head.json, the dispatched seq, the base URL, a fetch that fails
 * with another status than 404, and writing the output directory.
 */
export type ProjectionFindingCode =
	| 'fetch_missing'
	| 'manifest_hash_mismatch'
	| 'public_key_invalid'
	| 'signature_invalid'
	| 'manifest_not_json'
	| 'contract_mismatch'
	| 'manifest_schema'
	| 'manifest_not_canonical'
	| 'target_mismatch'
	| 'seq_regressed'
	| 'kind_mismatch'
	| 'slug_mismatch'
	| 'duplicate'
	| 'order_invalid'
	| 'path_conflict'
	| 'redirect_conflict'
	| 'media_type_invalid'
	| 'media_type_mismatch'
	| 'blob_hash_mismatch'
	| 'blob_size_mismatch'
	| 'document_invalid'
	| 'document_mismatch'
	| 'byline_mismatch'
	| 'approval_mismatch'
	| 'html_not_utf8'
	| 'html_script'
	| 'html_event_handler'
	| 'html_javascript_url'
	| 'head_invalid'
	| 'dispatch_mismatch'
	| 'base_url_invalid'
	| 'fetch_failed'
	| 'output_failed';

export interface ProjectionFinding {
	readonly code: ProjectionFindingCode;
	/** Where: a public path, or a field path inside the manifest. */
	readonly at: string;
	readonly detail: string;
}

export const finding = (code: ProjectionFindingCode, at: string, detail: string): ProjectionFinding => ({
	code,
	at,
	detail,
});

/** One line per finding, for logs and for the CLI. */
export function formatFinding(item: ProjectionFinding): string {
	return `${item.code} at ${item.at}: ${item.detail}`;
}
