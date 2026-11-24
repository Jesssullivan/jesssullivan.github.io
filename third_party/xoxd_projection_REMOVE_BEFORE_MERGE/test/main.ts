// The one entry the Bazel test runs. node:test collects every suite these
// modules declare and sets a non-zero exit code when any test fails.
import './vendored.test.ts';
import './canonical.test.ts';
import './verify.test.ts';
import './fetch.test.ts';
import './dist.test.ts';
