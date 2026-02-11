# transscendsurvival.org — SvelteKit blog task runner
# Prerequisites: just (brew install just), Node.js >= 22, npm
# Quick Start: just setup && just dev

set dotenv-load := true
set shell := ["bash", "-euo", "pipefail", "-c"]

root := justfile_directory()

# List available commands
default:
    @just --list --unsorted

# =============================================================================
# Development
# =============================================================================

# First-time setup
setup:
    npm install
    @echo "Setup complete. Run 'just dev' to start."

# Start dev server
dev:
    npm run dev

# Start dev server and open browser
dev-open:
    npm run dev -- --open

# =============================================================================
# Building
# =============================================================================

# Production build (redirects + pagefind)
build:
    npm run build

# Clean then build
rebuild: clean build

# Preview production build
preview: build
    npm run preview

# Preview without rebuilding
preview-only:
    npm run preview

# =============================================================================
# Validation
# =============================================================================

# Validate post frontmatter
validate-frontmatter:
    node scripts/validate-frontmatter.mjs

# Type check with svelte-check
check:
    npm run check

# Validate redirects after build
test-redirects:
    npm run test:redirects

# Run Playwright E2E tests (builds + serves automatically)
test-e2e:
    npx playwright test

# Run a specific E2E test file
test-e2e-file file:
    npx playwright test {{file}}

# Run E2E tests with visible browser
test-e2e-headed:
    npx playwright test --headed

# Run all tests (redirects + E2E)
test: test-redirects test-e2e

# =============================================================================
# Cleanup
# =============================================================================

# Remove build artifacts
clean:
    rm -rf build .svelte-kit

# Deep clean including node_modules
clean-all: clean
    rm -rf node_modules

# =============================================================================
# Utilities
# =============================================================================

# Sync SvelteKit types
sync:
    npx svelte-kit sync

# Show environment info
info:
    @echo "Node:  $$(node --version)"
    @echo "npm:   $$(npm --version)"
    @echo "Root:  {{root}}"
