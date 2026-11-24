/**
 * xoxd_projection: the consumer side of the xoxd-projection/v2 contract. This
 * entry needs Web Crypto and standard JavaScript only. The Node fetcher that
 * writes a site's output directory is the ./fetch export.
 */
export * from './contract.ts';
export { decodeBase64, encodeBase64, sha256OfBytes } from './bytes.ts';
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
} from './canonical.ts';
export { finding, formatFinding } from './findings.ts';
export type { ProjectionFinding, ProjectionFindingCode } from './findings.ts';
export { checkHtml } from './html.ts';
export { shapeHead, shapeManifest, shapePublicDocument } from './shape.ts';
export type { Shaped } from './shape.ts';
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
} from './verify.ts';
export type {
	ManifestExpectation,
	ManifestInput,
	ProjectionInput,
	ReadBlob,
	Verification,
	VerifiedProjection,
} from './verify.ts';
