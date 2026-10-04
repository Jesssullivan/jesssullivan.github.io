// Narrow app-owned producer parity diagnostic: no packages, browser or build.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import ts from '/Users/jess/git/jesssullivan.github.io/node_modules/typescript/lib/typescript.js';
import {
	reviewedMarkdownDocumentSurface,
	validateReviewedInlineDisclosureMarkdown,
	reviewedTargetFile,
} from '/Users/jess/git/tinyland.dev.worktrees/blog-media-edge-design-20260927/src/lib/server/content/reviewedSvxContract.js';
import {
	projectBlogBrokerDisplayMarkdown,
	validatePortableBlogBrokerMarkdown,
} from '/Users/jess/git/tinyland.dev.worktrees/blog-media-edge-design-20260927/src/lib/server/content/blogBrokerDisplayMarkdown.ts';
import {
	compileReviewedComponentMarkdown,
	renderReviewedComponentsForRuntime,
} from '/Users/jess/git/jesssullivan.github.io.worktrees/security-source-reconcile-20261004/src/lib/tinyland/reviewedComponents.ts';

let cases = 0;
const examples = [
	...['~~~', '~~~~', '````', '  ~~~'].map((fence) => `${fence}svx\n<script>{notExecutable}</script>\n<InlineDisclosure label="Literal">example</InlineDisclosure>\n${fence}`),
	'~~~~svx\n~~~\n```\n<script>{notExecutable}</script>\n~~~~',
	'~~~svx\n<InlineDisclosure label="Literal">{notExecutable}',
	'  ~~~svx\r\n<script>{notExecutable}</script>\r\n ~~~~\t\r\n',
	'~~~svx\n~~~ not a close\n<script>{notExecutable}</script>\n~~~',
	...['\r', '\n', '\r\n'].map((ending) => `~~~svx${ending}<script>{literal}</script>${ending}~~~${ending}`),
];
for (const content of examples) {
	assert.equal(validateReviewedInlineDisclosureMarkdown(content), false);
	validatePortableBlogBrokerMarkdown(content);
	assert.equal(reviewedTargetFile({ date: '2026-09-30' }, 'example', content), 'src/posts/2026-09-30-example.md');
	assert.deepEqual(compileReviewedComponentMarkdown(content).imports, []);
	assert.equal(renderReviewedComponentsForRuntime(content), content);
	assert.equal(projectBlogBrokerDisplayMarkdown({ sourceRecord: 'content/users/jesssullivan/blog/example.md', slug: 'example', title: 'Example', content }), content);
	cases++;
}
const literal = examples[0] + '\n';
const real = '<InlineDisclosure label="Reviewed">Body</InlineDisclosure>';
validatePortableBlogBrokerMarkdown(literal + real);
assert.equal(validateReviewedInlineDisclosureMarkdown(literal + real), true);
assert.equal(reviewedTargetFile({ date: '2026-09-30' }, 'example', literal + real), 'src/posts/2026-09-30-example.svx');
assert.deepEqual(compileReviewedComponentMarkdown(literal + real).imports, ['InlineDisclosure']);
cases++;
const { compile } = await import(createRequire('/Users/jess/git/jesssullivan.github.io/package.json').resolve('mdsvex'));
const crEscape = '~~~\nexample\n~~~\r<script>const proof = 1;</script>\n<InlineDisclosure label="Real">Body</InlineDisclosure>';
const compilerEscape = await compile(crEscape);
assert.ok(compilerEscape.code.includes('<script>const proof = 1;</script>'));
assert.ok(compilerEscape.code.includes('<InlineDisclosure label="Real">'));
assert.throws(() => validatePortableBlogBrokerMarkdown(crEscape), /raw HTML or unknown components/);
assert.throws(() => validateReviewedInlineDisclosureMarkdown(crEscape), /raw HTML or unknown components/);
assert.throws(() => compileReviewedComponentMarkdown(crEscape), /raw HTML or unknown components/);
assert.throws(() => renderReviewedComponentsForRuntime(crEscape), /raw HTML or unknown components/);
const crCode = '~~~svx\r<script>const proof = 1;</script>\r~~~\r';
const compilerLiteral = await compile(crCode);
assert.ok(!compilerLiteral.code.includes('<script>const proof = 1;</script>'));
assert.ok(compilerLiteral.code.includes('&lt;script'));
validatePortableBlogBrokerMarkdown(crCode);
assert.equal(renderReviewedComponentsForRuntime(crCode), crCode);
cases++;
for (const unsafe of [
	'<script>danger</script>',
	'{@html danger}',
	'import Danger from "./Danger.svelte";',
	'<InlineDisclosure label="Unsafe" onclick={run}>x</InlineDisclosure>',
	'<UnknownComponent>danger</UnknownComponent>',
]) {
	assert.throws(() => validatePortableBlogBrokerMarkdown(literal + unsafe));
	assert.throws(() => compileReviewedComponentMarkdown(literal + unsafe));
	cases++;
}
// Check the actual staged browser body's boundary, not just duplicated examples.
const fixtureText = readFileSync('/Users/jess/git/jesssullivan.github.io.worktrees/security-source-reconcile-20261004/e2e/document-root.spec.ts', 'utf8');
const fixture = ts.createSourceFile('fixture.ts', fixtureText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let actual;
function walk(node) {
	if (ts.isVariableDeclaration(node) && node.name.getText(fixture) === 'contentMarkdown' && node.initializer && ts.isCallExpression(node.initializer) && ts.isPropertyAccessExpression(node.initializer.expression) && ts.isArrayLiteralExpression(node.initializer.expression.expression)) {
		actual = node.initializer.expression.expression.elements.map((item) => item.text).join('\n');
	}
	ts.forEachChild(node, walk);
}
walk(fixture);
assert.ok(actual);
validatePortableBlogBrokerMarkdown(actual);
assert.equal(validateReviewedInlineDisclosureMarkdown(actual), true);
assert.deepEqual(compileReviewedComponentMarkdown(actual).imports, ['InlineDisclosure']);
assert.equal(projectBlogBrokerDisplayMarkdown({ sourceRecord: 'content/users/jesssullivan/blog/example.md', slug: 'example', title: 'Example', content: actual }), actual);
assert.equal(reviewedMarkdownDocumentSurface('~~~text\nsafe\n~~~\nAfter'), '\nAfter');
cases++;
const repoRoot = '/Users/jess/git/tinyland.dev.worktrees/blog-media-edge-design-20260927';
const baselineSha = 'f1d3844515e46e423faaa80131000d2401bc7a1e';
const oldContractSource = execFileSync('git', ['show', baselineSha + ':src/lib/server/content/reviewedSvxContract.js'], { cwd: repoRoot, encoding: 'utf8' });
const oldContractUrl = 'data:text/javascript;base64,' + Buffer.from(oldContractSource).toString('base64');
const oldBrokerSource = execFileSync('git', ['show', baselineSha + ':src/lib/server/content/blogBrokerDisplayMarkdown.ts'], { cwd: repoRoot, encoding: 'utf8' });
const oldBrokerCompiled = ts.transpileModule(oldBrokerSource.replace("'./reviewedSvxContract.js'", JSON.stringify(oldContractUrl)), {
	compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const baseline = await import('data:text/javascript;base64,' + Buffer.from(oldBrokerCompiled).toString('base64'));
const registryTestPath = repoRoot + '/tests/unit/content/blog-projection-registry.test.ts';
const registryText = readFileSync(registryTestPath, 'utf8');
const registry = ts.createSourceFile(registryTestPath, registryText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let slugs;
function registryWalk(node) {
	if (ts.isVariableDeclaration(node) && node.name.getText(registry) === 'knownDisplayAdapterSlugs') {
		const array = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
		assert.ok(ts.isArrayLiteralExpression(array));
		slugs = array.elements.map((item) => item.text);
	}
	ts.forEachChild(node, registryWalk);
}
registryWalk(registry);
assert.ok(slugs?.length);
for (const slug of slugs) {
	const sourceRecord = `content/users/jesssullivan/blog/${slug}.md`;
	const raw = readFileSync(repoRoot + '/' + sourceRecord, 'utf8');
	const content = raw.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
	const input = { sourceRecord, slug, title: slug, content };
	assert.equal(projectBlogBrokerDisplayMarkdown(input), baseline.projectBlogBrokerDisplayMarkdown(input), `${slug}: reviewed native display adapter must stay unchanged`);
}
console.log(`${cases} producer/consumer fence and fail-closed scenarios passed, including exact browser body; ${slugs.length} existing native display-adapter bodies unchanged against ${baselineSha}; installed mdsvex proves bare-CR escape remains executable but BOTH guards reject it and bare-CR code stays escaped; pure local diagnostic only`);
