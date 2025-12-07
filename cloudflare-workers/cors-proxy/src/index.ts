/**
 * WordPress Playground CORS Proxy Worker
 *
 * A truly transparent CORS proxy that:
 * - Passes through ALL HTTP methods
 * - Passes through ALL headers (except those that would break the proxy)
 * - Passes through ALL response data unmodified
 * - Only adds CORS headers to allow cross-origin access
 */

export interface Env {
	ALLOWED_ORIGINS?: string; // JSON array of allowed origins
}

const DEFAULT_ALLOWED_ORIGINS = [
	'https://playground.wordpress.net',
	'http://localhost',
	'http://127.0.0.1',
	'http://127.0.0.1:5400',
	'http://localhost:5400',
	'http://127.0.0.1:4400',
	'http://localhost:4400',
];

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
 * Forward request headers - pass through everything except 'host'
 */
function forwardRequestHeaders(headers: Headers, targetHost: string): Headers {
	const forwarded = new Headers();
	headers.forEach((value, name) => {
		const lowerName = name.toLowerCase();
		// Skip 'host' - we set it to the target
		if (lowerName === 'host') {
			return;
		}
		forwarded.set(name, value);
	});
	forwarded.set('Host', targetHost);
	return forwarded;
}

/**
 * Forward response headers - pass through everything except CORS headers (we add our own)
 */
function forwardResponseHeaders(headers: Headers): Headers {
	const forwarded = new Headers();
	headers.forEach((value, name) => {
		const lowerName = name.toLowerCase();
		// Skip CORS headers - we add our own
		if (lowerName.startsWith('access-control-')) {
			return;
		}
		forwarded.append(name, value);
	});
	return forwarded;
}

/**
 * Handle CORS preflight request
 */
function handlePreflight(origin: string, env: Env): Response {
	const headers = new Headers();

	if (shouldRespondWithCorsHeaders(origin, env)) {
		headers.set('Access-Control-Allow-Origin', origin);
		headers.set('Access-Control-Allow-Credentials', 'true');
		headers.set('Access-Control-Allow-Methods', '*');
		headers.set('Access-Control-Allow-Headers', '*');
		headers.set('Access-Control-Max-Age', '86400');
	}

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

		// Forward request headers
		const proxyHeaders = forwardRequestHeaders(
			request.headers,
			parsedTarget.host
		);

		// Create the proxied request - pass through method and body
		const proxyRequest = new Request(targetUrl, {
			method: request.method,
			headers: proxyHeaders,
			body:
				request.method !== 'GET' && request.method !== 'HEAD'
					? request.body
					: undefined,
			redirect: 'manual', // Let client handle redirects
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

		// Forward response headers
		const responseHeaders = forwardResponseHeaders(response.headers);

		// Add CORS headers if origin is whitelisted
		if (shouldRespondWithCorsHeaders(origin, env)) {
			responseHeaders.set('Access-Control-Allow-Origin', origin);
			responseHeaders.set('Access-Control-Allow-Credentials', 'true');
			responseHeaders.set('Access-Control-Allow-Methods', '*');
			responseHeaders.set('Access-Control-Allow-Headers', '*');
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: responseHeaders,
		});
	},
};
