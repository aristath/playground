/**
 * WordPress Playground Static File Server
 *
 * A Cloudflare Worker that serves static files from R2 bucket.
 * All SPA routing is handled client-side by the service worker.
 */

export interface Env {
	PLAYGROUND_BUCKET: R2Bucket;
}

// MIME types mapping
const MIME_TYPES: Record<string, string> = {
	html: 'text/html; charset=utf-8',
	htm: 'text/html; charset=utf-8',
	css: 'text/css; charset=utf-8',
	js: 'application/javascript; charset=utf-8',
	mjs: 'application/javascript; charset=utf-8',
	json: 'application/json; charset=utf-8',
	wasm: 'application/wasm',
	zip: 'application/zip',
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	svg: 'image/svg+xml',
	ico: 'image/x-icon',
	webp: 'image/webp',
	avif: 'image/avif',
	woff: 'font/woff',
	woff2: 'font/woff2',
	ttf: 'font/ttf',
	otf: 'font/otf',
	eot: 'application/vnd.ms-fontobject',
	phar: 'application/octet-stream',
	so: 'application/octet-stream',
	dat: 'application/octet-stream',
	gz: 'application/gzip',
	map: 'application/json',
	xml: 'application/xml',
	txt: 'text/plain; charset=utf-8',
	md: 'text/markdown; charset=utf-8',
};

// Paths that should never be cached (always fresh)
const NO_CACHE_PATHS = [
	'/',
	'/index.html',
	'/remote.html',
	'/index.js',
	'/blueprint-schema.json',
	'/wp-cli.phar',
	'/wordpress-importer.zip',
];

// Files requiring CORS headers
const CORS_PATHS = [
	'/index.js',
	'/blueprint-schema.json',
	'/wp-cli.phar',
	'/wordpress-importer.zip',
	'/client/',
];

// Simple redirects (permanent)
const REDIRECTS: Record<string, { location: string; status: number }> = {
	'/docs': {
		location: 'https://wordpress.github.io/wordpress-playground/',
		status: 301,
	},
	'/builder/': { location: '/builder/builder.html', status: 301 },
	'/builder': { location: '/builder/builder.html', status: 301 },
	'/wordpress': { location: '/wordpress.html', status: 301 },
	'/gutenberg': { location: '/gutenberg.html', status: 301 },
	'/proxy': { location: 'https://github-proxy.com/', status: 301 },
	'/wordpress-browser.html': { location: '/', status: 301 },
	'/release': {
		location:
			'/?blueprint-url=https://raw.githubusercontent.com/wordpress/blueprints/trunk/blueprints/beta-rc/blueprint.json',
		status: 301,
	},
};

function getExtension(path: string): string {
	const parts = path.split('.');
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function getContentType(path: string): string {
	const ext = getExtension(path);
	return MIME_TYPES[ext] || 'application/octet-stream';
}

function shouldNeverCache(path: string): boolean {
	return NO_CACHE_PATHS.some((p) => path === p || path.startsWith(p + '?'));
}

function needsCorsHeaders(path: string): boolean {
	return CORS_PATHS.some((p) => path === p || path.startsWith(p));
}

function isZipStoreFile(path: string): boolean {
	return path.endsWith('store.zip');
}

function hasHashInFilename(path: string): boolean {
	// Match patterns like: filename-abc12345.js or filename.abc12345.js
	return /[-\.][a-f0-9]{8,}\.[^\/]+$/i.test(path);
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const url = new URL(request.url);
		let pathname = url.pathname;

		// Handle redirects
		if (REDIRECTS[pathname]) {
			const redirect = REDIRECTS[pathname];
			return Response.redirect(
				new URL(redirect.location, url).toString(),
				redirect.status
			);
		}

		// Normalize path - add index.html for directory requests
		if (pathname.endsWith('/')) {
			pathname = pathname + 'index.html';
		} else if (pathname === '') {
			pathname = '/index.html';
		}

		// Remove leading slash for R2 key
		const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;

		// Try to get the object from R2
		let object = await env.PLAYGROUND_BUCKET.get(key);

		// If not found and no extension, try with .html
		if (!object && !getExtension(pathname)) {
			object = await env.PLAYGROUND_BUCKET.get(key + '.html');
		}

		// If still not found, return 404
		if (!object) {
			return new Response('Not Found', { status: 404 });
		}

		// Build response headers
		const headers = new Headers();
		headers.set('Content-Type', getContentType(pathname));

		// Cache control
		if (shouldNeverCache(pathname)) {
			headers.set(
				'Cache-Control',
				'max-age=0, no-cache, no-store, must-revalidate'
			);
		} else if (hasHashInFilename(pathname)) {
			// Static assets with hash in filename can be cached forever
			headers.set('Cache-Control', 'public, max-age=31536000, immutable');
		} else {
			// Others get moderate caching
			headers.set('Cache-Control', 'public, max-age=3600');
		}

		// CORS headers for specific files
		if (needsCorsHeaders(pathname)) {
			headers.set('Access-Control-Allow-Origin', '*');
		}

		// Special handling for store.zip files (WordPress static assets)
		if (isZipStoreFile(pathname)) {
			headers.set('Content-Encoding', 'identity');
			headers.set('Access-Control-Allow-Origin', '*');
		}

		// Special header for iframe-worker.html
		if (pathname.endsWith('iframe-worker.html')) {
			headers.set('Origin-Agent-Cluster', '?1');
		}

		// ETag from R2 object
		if (object.httpEtag) {
			headers.set('ETag', object.httpEtag);
		}

		// Handle conditional requests
		const ifNoneMatch = request.headers.get('If-None-Match');
		if (ifNoneMatch && object.httpEtag && ifNoneMatch === object.httpEtag) {
			return new Response(null, { status: 304, headers });
		}

		// Handle HEAD requests
		if (request.method === 'HEAD') {
			headers.set('Content-Length', object.size.toString());
			return new Response(null, { status: 200, headers });
		}

		// Handle range requests for large files (WASM, ZIP)
		const range = request.headers.get('Range');
		if (range) {
			const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
			if (rangeMatch) {
				const start = parseInt(rangeMatch[1], 10);
				const end = rangeMatch[2]
					? parseInt(rangeMatch[2], 10)
					: object.size - 1;

				headers.set(
					'Content-Range',
					`bytes ${start}-${end}/${object.size}`
				);
				headers.set('Content-Length', (end - start + 1).toString());
				headers.set('Accept-Ranges', 'bytes');

				// R2 supports range requests natively
				const rangedObject = await env.PLAYGROUND_BUCKET.get(key, {
					range: { offset: start, length: end - start + 1 },
				});

				if (rangedObject) {
					return new Response(rangedObject.body, {
						status: 206,
						headers,
					});
				}
			}
		}

		headers.set('Content-Length', object.size.toString());
		return new Response(object.body, { status: 200, headers });
	},
};
