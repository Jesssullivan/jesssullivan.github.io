// Generated from src/ by tools/emit-js.ts. Edit the TypeScript source.
/**
 * xoxd_projection: the consumer side of the xoxd-projection/v2 contract. This
 * entry needs Web Crypto and standard JavaScript only. The Node fetcher that
 * writes a site's output directory is the ./fetch export.
 */
export * from './contract.js';
export { decodeBase64, encodeBase64, sha256OfBytes } from './bytes.js';
export {
	approvalHash,
	attachmentsHash,
	canonicalJson,
	canonicalJsonWithNull,
	combineHashes,
	componentHashes,
	hashOf,
	publicComponentHashes,
	variantsHash,
} from './canonical.js';
export { finding, formatFinding } from './findings.js';
export { checkHtml } from './html.js';
export { shapeHead, shapeManifest, shapePublicDocument } from './shape.js';
export {
	checkHead,
	checkManifest,
	checkRebuild,
	legacyRedirectSource,
	recomputeApproval,
	sniffMediaType,
	verifyBlob,
	verifyEntries,
	verifyManifest,
	verifyManifestBytes,
	verifyProjection,
} from './verify.js';
