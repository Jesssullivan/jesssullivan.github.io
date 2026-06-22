#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'build');
const port = Number(process.argv[3] ?? process.env.PORT ?? 3000);

if (!existsSync(root) || !statSync(root).isDirectory()) {
	console.error(`Static build root does not exist: ${root}`);
	process.exit(1);
}

const server = createServer((request, response) => {
	const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
	const candidates = candidatePaths(url.pathname);
	let filePath = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
	let status = 200;

	if (!filePath) {
		filePath = join(root, '404.html');
		status = 404;
	}

	if (!filePath || !existsSync(filePath)) {
		response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
		response.end('not found');
		return;
	}

	response.writeHead(status, { 'content-type': contentType(filePath) });
	createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
	console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});

function candidatePaths(pathname) {
	const decoded = decodeURIComponent(pathname);
	const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, '');
	const relative = clean === sep ? '' : clean.replace(/^[/\\]/, '');
	const base = resolve(root, relative);

	if (!base.startsWith(root)) {
		return [];
	}

	if (decoded.endsWith('/')) {
		return [join(base, 'index.html')];
	}

	const candidates = [base];
	if (!extname(base)) {
		candidates.push(`${base}.html`);
	}
	candidates.push(join(base, 'index.html'));
	return candidates;
}

function contentType(path) {
	switch (extname(path)) {
		case '.avif':
			return 'image/avif';
		case '.css':
			return 'text/css; charset=utf-8';
		case '.html':
			return 'text/html; charset=utf-8';
		case '.js':
			return 'text/javascript; charset=utf-8';
		case '.json':
			return 'application/json; charset=utf-8';
		case '.pdf':
			return 'application/pdf';
		case '.png':
			return 'image/png';
		case '.svg':
			return 'image/svg+xml';
		case '.webp':
			return 'image/webp';
		case '.xml':
			return 'application/xml; charset=utf-8';
		default:
			return 'application/octet-stream';
	}
}
