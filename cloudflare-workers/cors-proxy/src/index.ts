/**
 * WordPress Playground CORS Proxy Worker
 *
 * A Cloudflare Worker that proxies requests to external URLs,
 * adding CORS headers for allowed origins.
 */

export interface Env {
	ALLOWED_ORIGINS?: string; // JSON array of allowed origins
}

const MAX_REQUEST_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_RESPONSE_SIZE = 100 * 1024 * 1024; // 100MB

const DEFAULT_ALLOWED_ORIGINS = [
	'https://playground.wordpress.net',
	'http://localhost',
	'http://127.0.0.1',
	'http://127.0.0.1:5400',
	'http://localhost:5400',
	'http://127.0.0.1:4400',
	'http://localhost:4400',
];

// Headers that are never forwarded
const STRICTLY_DISALLOWED_HEADERS = new Set(['cookie', 'host']);

// Headers that require explicit opt-in via X-Cors-Proxy-Allowed-Request-Headers
const HEADERS_REQUIRING_OPT_IN = new Set(['authorization']);

// Headers filtered from the response
const FILTERED_RESPONSE_HEADERS = new Set([
	'set-cookie',
	'authorization',
	'www-authenticate',
	'cache-control',
	'access-control-allow-origin',
	'access-control-allow-credentials',
	'access-control-allow-methods',
	'access-control-allow-headers',
]);

/**
 * Extract target URL from the proxy request
 */
function getTargetUrl(proxyUrl: URL): string | null {
	// Try query string first (e.g., ?https://example.com)
	const queryString = proxyUrl.search.slice(1); // Remove leading ?
	if (queryString && queryString.startsWith('http')) {
		return queryString;
	}

	// Try path (e.g., /https://example.com)
	const pathname = proxyUrl.pathname;
	if (pathname.length > 1) {
		const target = pathname.slice(1); // Remove leading /
		if (target.startsWith('http')) {
			return target;
		}
	}

	return null;
}

/**
 * Validate target URL
 */
function validateUrl(
	targetUrl: string,
	proxyHost: string
): { url: URL; error: string | null } {
	let parsed: URL;
	try {
		parsed = new URL(targetUrl);
	} catch {
		return {
			url: null as unknown as URL,
			error: `Invalid URL: ${targetUrl}`,
		};
	}

	// Only allow http and https
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		return { url: parsed, error: `Invalid protocol: ${parsed.protocol}` };
	}

	// Reject URLs with embedded credentials
	if (parsed.username || parsed.password) {
		return {
			url: parsed,
			error: 'URL containing forbidden user or password information',
		};
	}

	// Prevent targeting the proxy itself
	if (parsed.host.toLowerCase() === proxyHost.toLowerCase()) {
		return { url: parsed, error: 'URL cannot target the CORS proxy host.' };
	}

	// Check for private IP patterns in the hostname
	// Note: Cloudflare Workers have built-in SSRF protection, but we add URL-based checks
	const host = parsed.hostname.toLowerCase();
	if (isPrivateHostname(host)) {
		return { url: parsed, error: 'Private IPs are forbidden' };
	}

	return { url: parsed, error: null };
}

/**
 * Check if hostname appears to be a private/local address
 */
function isPrivateHostname(hostname: string): boolean {
	// Check for localhost variants
	if (
		hostname === 'localhost' ||
		hostname === '127.0.0.1' ||
		hostname === '::1' ||
		hostname.endsWith('.localhost')
	) {
		return true;
	}

	// Check for private IPv4 ranges in hostname
	const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
	if (ipv4Match) {
		const [, a, b, c, d] = ipv4Match.map(Number);

		// 10.0.0.0/8
		if (a === 10) return true;

		// 172.16.0.0/12
		if (a === 172 && b >= 16 && b <= 31) return true;

		// 192.168.0.0/16
		if (a === 192 && b === 168) return true;

		// 127.0.0.0/8 (loopback)
		if (a === 127) return true;

		// 169.254.0.0/16 (link-local)
		if (a === 169 && b === 254) return true;

		// 0.0.0.0/8
		if (a === 0) return true;

		// 100.64.0.0/10 (carrier-grade NAT)
		if (a === 100 && b >= 64 && b <= 127) return true;

		// 192.0.0.0/24 (IETF protocol assignments)
		if (a === 192 && b === 0 && c === 0) return true;

		// 198.18.0.0/15 (benchmark testing)
		if (a === 198 && (b === 18 || b === 19)) return true;

		// 224.0.0.0/4 (multicast)
		if (a >= 224 && a <= 239) return true;

		// 240.0.0.0/4 (reserved)
		if (a >= 240) return true;
	}

	return false;
}

/**
 * Get list of allowed origins
 */
function getAllowedOrigins(env: Env): string[] {
	if (env.ALLOWED_ORIGINS) {
		try {
			return JSON.parse(env.ALLOWED_ORIGINS);
		} catch {
			return DEFAULT_ALLOWED_ORIGINS;
		}
	}
	return DEFAULT_ALLOWED_ORIGINS;
}

/**
 * Check if origin should receive CORS headers
 */
function shouldRespondWithCorsHeaders(origin: string, env: Env): boolean {
	if (!origin) {
		return false;
	}
	const allowedOrigins = getAllowedOrigins(env);
	return allowedOrigins.some(
		(allowed) => origin === allowed || origin.startsWith(allowed)
	);
}

/**
 * Filter request headers before forwarding
 */
function filterRequestHeaders(headers: Headers): Headers {
	const filtered = new Headers();

	// Get opt-in headers
	const optInHeadersStr =
		headers.get('x-cors-proxy-allowed-request-headers') || '';
	const optInHeaders = new Set(
		optInHeadersStr
			.split(',')
			.map((h) => h.trim().toLowerCase())
			.filter(Boolean)
	);

	headers.forEach((value, name) => {
		const lowerName = name.toLowerCase();

		// Skip strictly disallowed headers
		if (STRICTLY_DISALLOWED_HEADERS.has(lowerName)) {
			return;
		}

		// Skip headers requiring opt-in unless opted in
		if (
			HEADERS_REQUIRING_OPT_IN.has(lowerName) &&
			!optInHeaders.has(lowerName)
		) {
			return;
		}

		filtered.set(name, value);
	});

	return filtered;
}

/**
 * Filter response headers before sending to client
 */
function filterResponseHeaders(headers: Headers): Headers {
	const filtered = new Headers();

	headers.forEach((value, name) => {
		const lowerName = name.toLowerCase();

		// Skip filtered response headers
		if (FILTERED_RESPONSE_HEADERS.has(lowerName)) {
			return;
		}

		// Skip content-length (may change with streaming)
		if (lowerName === 'content-length') {
			return;
		}

		filtered.append(name, value);
	});

	return filtered;
}

/**
 * Rewrite redirect location to go through the proxy
 */
function rewriteRedirectLocation(
	requestUrl: string,
	redirectLocation: string,
	proxyBaseUrl: string
): string {
	const targetUrl = new URL(requestUrl);
	let absoluteLocation: string;

	try {
		// Try parsing as absolute URL
		new URL(redirectLocation);
		absoluteLocation = redirectLocation;
	} catch {
		// It's a relative URL, make it absolute
		if (redirectLocation.startsWith('/')) {
			// Absolute path
			absoluteLocation = `${targetUrl.protocol}//${targetUrl.host}${redirectLocation}`;
		} else {
			// Relative path
			const basePath = targetUrl.pathname.substring(
				0,
				targetUrl.pathname.lastIndexOf('/')
			);
			absoluteLocation = `${targetUrl.protocol}//${targetUrl.host}${basePath}/${redirectLocation}`;
		}
	}

	// Append to proxy URL
	const separator =
		proxyBaseUrl.endsWith('/') || proxyBaseUrl.endsWith('?') ? '' : '?';
	return `${proxyBaseUrl}${separator}${absoluteLocation}`;
}

/**
 * Handle CORS preflight request
 */
function handlePreflight(origin: string, env: Env): Response {
	const headers = new Headers();

	if (shouldRespondWithCorsHeaders(origin, env)) {
		headers.set('Access-Control-Allow-Origin', origin);
		headers.set('Access-Control-Allow-Credentials', 'true');
		headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		headers.set(
			'Access-Control-Allow-Headers',
			'Accept, Authorization, Content-Type, git-protocol, wp_blog, wp_install, x-cors-proxy-allowed-request-headers'
		);
		headers.set('Access-Control-Max-Age', '86400');
	}

	headers.set('Allow', 'GET, POST, OPTIONS');

	return new Response(null, { status: 204, headers });
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get('Origin') || '';
		const host = url.host;

		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return handlePreflight(origin, env);
		}

		// Only allow GET and POST
		if (request.method !== 'GET' && request.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		// Check request size for POST
		const contentLength = request.headers.get('Content-Length');
		if (request.method === 'POST' && contentLength) {
			if (parseInt(contentLength, 10) >= MAX_REQUEST_SIZE) {
				return new Response('Request Entity Too Large', {
					status: 413,
				});
			}
		}

		// Extract target URL from query string or path
		const targetUrl = getTargetUrl(url);
		if (!targetUrl) {
			return new Response('Bad Request\n\nNo URL provided', {
				status: 400,
			});
		}

		// Validate target URL
		const { url: parsedTarget, error } = validateUrl(targetUrl, host);
		if (error) {
			return new Response(`Bad Request\n\n${error}`, { status: 400 });
		}

		// Build proxied request headers
		const proxyHeaders = filterRequestHeaders(request.headers);
		proxyHeaders.set('Host', parsedTarget.host);

		// Create the proxied request
		const proxyRequest = new Request(targetUrl, {
			method: request.method,
			headers: proxyHeaders,
			body: request.method !== 'GET' ? request.body : undefined,
			redirect: 'manual', // Handle redirects ourselves
		});

		let response: Response;
		try {
			response = await fetch(proxyRequest);
		} catch (error) {
			return new Response(
				`Bad Gateway\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
				{ status: 502 }
			);
		}

		// Check response size
		const responseContentLength = response.headers.get('Content-Length');
		if (
			responseContentLength &&
			parseInt(responseContentLength, 10) >= MAX_RESPONSE_SIZE
		) {
			return new Response('Response Too Large', { status: 413 });
		}

		// Build response headers
		const responseHeaders = filterResponseHeaders(response.headers);

		// Add CORS headers if origin is whitelisted
		if (shouldRespondWithCorsHeaders(origin, env)) {
			responseHeaders.set('Access-Control-Allow-Origin', origin);
			responseHeaders.set('Access-Control-Allow-Credentials', 'true');
			responseHeaders.set(
				'Access-Control-Allow-Methods',
				'GET, POST, OPTIONS'
			);
			responseHeaders.set(
				'Access-Control-Allow-Headers',
				'Accept, Authorization, Content-Type, git-protocol, wp_blog, wp_install, x-cors-proxy-allowed-request-headers'
			);
		}

		// Disable caching
		responseHeaders.set('Cache-Control', 'no-cache');

		// Handle redirects - rewrite Location header
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('Location');
			if (location) {
				const proxyBaseUrl = `${url.protocol}//${url.host}${url.pathname}`;
				const newLocation = rewriteRedirectLocation(
					targetUrl,
					location,
					proxyBaseUrl
				);
				responseHeaders.set('Location', newLocation);
			}
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders,
		});
	},
};
