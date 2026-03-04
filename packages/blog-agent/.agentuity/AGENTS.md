# Compiled Agentuity Application

This directory contains compiled and bundled source code from an Agentuity application.

## Source Repository

**Repository:** https://github.com/Jesssullivan/jesssullivan.github.io
**Branch:** main
**Commit:** [`bd773d7`](https://github.com/Jesssullivan/jesssullivan.github.io/commit/bd773d71b2191605bbf58fb42a56e1d32b246750)
**Message:** feat: add AGENTS.md writing style guide (#45)

## Build Information

**Project:** @blog/agent v0.1.0
**Project ID:** proj_9b63628b4676a17e667cb92a64e50a05
**Org ID:** org_3AUDrKcuzD7NPC8NQat3Is3PaKF
**Deployment ID:** deploy_a00c09d3cc515784e169e3056097da32
**Built with:** Agentuity CLI v1.0.33, Bun v1.3.10
**Platform:** darwin-arm64
**Build date:** 2026-03-04T20:59:06.088Z

## Structure

```
.agentuity/
├── app.js                     # Bundled server application
├── agentuity.metadata.json    # Build metadata and schemas
└── AGENTS.md                  # This file
```

## Agents

This application defines 1 agent(s):

- **webhook** (ID: `agentid_4b9e7a2954070c6989df45ee2a1e4f7963f21b5d`)

## Runtime Environment

When deployed, this application runs in a managed runtime environment with:

**User & Permissions:**
- User: `agentuity` (UID: 1022, GID: 1777)
- Home directory: `/home/agentuity`
- Working directory: `/home/agentuity` (application code deployed here)
- Logs directory: `/home/agentuity/logs`
- Temp directory: `/home/agentuity/tmp`

**Pre-installed Tools:**
- **Runtimes:** Node.js 24, Bun 1.x
- **AI Tools:** Amp, Opencode AI, Claude Code
- **Version Control:** git, GitHub CLI (gh)
- **Browser Automation:** Chromium, ChromeDriver, Xvfb (headless display)
- **Media Processing:** ffmpeg
- **Network Tools:** curl, wget, netcat, dnsutils
- **Other:** openssh-client, openssh-sftp-server, strace, unzip, fuse

**Environment Variables:**
- `AGENTUITY_DATA_DIR=/home/agentuity/data` - Persistent data storage
- `AGENTUITY_LOG_DIR=/home/agentuity/logs` - Application logs
- `CHROME_BIN=/usr/bin/chromium` - Chromium browser path
- `DISPLAY=:99` - X11 display for headless browser
- `PATH` includes `/home/agentuity/.local/bin` and `/home/agentuity/.agentuity/bin`

**Ports:**
- `3000: This default port that the project is running. Use PORT environment if not available

## For AI Coding Agents

This is production-ready compiled code. For development and source code modifications:

1. Clone the source repository: https://github.com/Jesssullivan/jesssullivan.github.io
2. Make changes to source files in `src/`
3. Run `agentuity build` to rebuild this bundle

See `agentuity.metadata.json` for detailed information about agents, routes, and schemas.