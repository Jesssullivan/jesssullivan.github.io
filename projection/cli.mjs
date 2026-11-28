#!/usr/bin/env node
// The entry point of bazel run //projection:step. The logic is in step.mjs,
// which the tests import without running it.
import { main } from './step.mjs';

process.exitCode = await main();
