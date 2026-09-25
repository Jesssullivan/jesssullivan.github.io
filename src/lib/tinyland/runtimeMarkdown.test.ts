import { describe, expect, it } from 'vitest';
import { brokerCodeLanguage, hasHighlightableBrokerFence } from './runtimeMarkdown';

describe('broker-only article code fences', () => {
	it('recognizes the shared common code-fence languages and aliases', () => {
		expect(brokerCodeLanguage('ts title=example.ts')).toBe('typescript');
		expect(brokerCodeLanguage('python')).toBe('python');
		expect(brokerCodeLanguage('nix')).toBe('nix');
	});

	it('leaves unsupported and unreviewed diagram languages as escaped source', () => {
		expect(brokerCodeLanguage('mermaid')).toBeNull();
		expect(brokerCodeLanguage('svx')).toBeNull();
		expect(brokerCodeLanguage('')).toBeNull();
	});

	it('only loads the highlighter for a supported fenced language', () => {
		expect(hasHighlightableBrokerFence('```ts\nconst x = 1;\n```')).toBe(true);
		expect(hasHighlightableBrokerFence('```mermaid\ngraph TD\n```')).toBe(false);
		expect(hasHighlightableBrokerFence('Here is `ts` inline.')).toBe(false);
	});
});
