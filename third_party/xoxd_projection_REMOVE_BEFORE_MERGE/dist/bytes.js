// Generated from src/ by tools/emit-js.ts. Edit the TypeScript source.
/**
 * Byte helpers over the Web Crypto API and standard JavaScript only, so the
 * module runs in Node 22 and newer and in any site build with Web Crypto.
 */

/**
 * A copy of the bytes in a plain ArrayBuffer of exactly their length. Web
 * Crypto takes one in every runtime, and older TypeScript libraries type it
 * the same way. The Uint8Array constructor copies into a new buffer. slice
 * would not do here: on a Node Buffer it returns a view of the shared pool,
 * and .buffer would then be the whole pool.
 */
export function plainBytes(bytes            )              {
	return new Uint8Array(bytes).buffer               ;
}

export function hex(bytes            )         {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Lowercase hex sha256 of some bytes. */
export async function sha256OfBytes(bytes            )                  {
	const digest = await globalThis.crypto.subtle.digest('SHA-256', plainBytes(bytes));
	return hex(new Uint8Array(digest));
}

/** Lowercase hex sha256 of the UTF-8 bytes of a string. */
export async function sha256OfText(text        )                  {
	return sha256OfBytes(new TextEncoder().encode(text));
}

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * Standard base64 with padding (RFC 4648 section 4), as the .sig files and the
 * pinned key use. Returns null for any other text, a line break included.
 */
export function decodeBase64(text        )                    {
	if (!BASE64.test(text)) return null;
	const binary = globalThis.atob(text);
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeBase64(bytes            )         {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return globalThis.btoa(binary);
}

/** Strict UTF-8 decoding. A byte order mark is kept as a character. Returns null for bytes that are not UTF-8. */
export function decodeUtf8(bytes            )                {
	try {
		return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
	} catch {
		return null;
	}
}
