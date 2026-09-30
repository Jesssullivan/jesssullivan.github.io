/** Top-level Markdown fences shared by validation and broker rendering. */
export type MarkdownFenceSegment = Readonly<{
	markdown: string;
	/** Present (possibly empty) only for a fenced code segment. */
	fenceInfo?: string;
}>;

export function splitMarkdownFences(markdown: string): MarkdownFenceSegment[] {
	const segments: MarkdownFenceSegment[] = [];
	let offset = 0;
	let proseStart = 0;
	let fence: { start: number; marker: string; length: number; info: string } | undefined;
	for (const line of markdown.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
		if (fence) {
			const close = line.match(/^ {0,3}(`{3,}|~{3,})[\t ]*\r?\n?$/);
			if (close && close[1][0] === fence.marker && close[1].length >= fence.length) {
				segments.push({ markdown: markdown.slice(fence.start, offset + line.length), fenceInfo: fence.info });
				fence = undefined;
				proseStart = offset + line.length;
			}
		} else {
			const open = line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)\r?\n?$/);
			// CommonMark disallows backticks in a backtick fence's info string.
			if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
				if (offset > proseStart) segments.push({ markdown: markdown.slice(proseStart, offset) });
				fence = { start: offset, marker: open[1][0], length: open[1].length, info: open[2].trim() };
			}
		}
		offset += line.length;
	}
	if (fence) {
		// An unclosed fence is code through EOF, never executable document prose.
		segments.push({ markdown: markdown.slice(fence.start), fenceInfo: fence.info });
	} else if (proseStart < markdown.length) {
		segments.push({ markdown: markdown.slice(proseStart) });
	}
	return segments;
}
