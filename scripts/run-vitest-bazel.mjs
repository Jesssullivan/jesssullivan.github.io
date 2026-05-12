import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { startVitest } from 'vitest/node';

const workspaceRoot = process.cwd();
const configPath = resolve(workspaceRoot, 'vitest.bazel.config.ts');

if (!existsSync(configPath)) {
	console.error(`Bazel Vitest config not found: ${configPath}`);
	process.exit(1);
}

process.env.CI = 'true';
process.env.NODE_ENV = 'test';

const vitest = await startVitest('test', process.argv.slice(2), {
	config: configPath,
	root: workspaceRoot,
	reporters: ['verbose'],
	watch: false,
});

if (!vitest) {
	process.exit(1);
}

await vitest.close();
const failed = vitest.state.getCountOfFailedTests();
const errors = vitest.state.getUnhandledErrors().length;
process.exit(failed > 0 || errors > 0 ? 1 : 0);
