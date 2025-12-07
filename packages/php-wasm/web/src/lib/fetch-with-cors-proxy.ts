import { cloneRequest } from '@php-wasm/web-service-worker';

export async function fetchWithCorsProxy(
	input: RequestInfo,
	init?: RequestInit,
	corsProxyUrl?: string,
	playgroundUrl?: string
): Promise<Response> {
	let requestObject =
		typeof input === 'string' ? new Request(input, init) : input;
	const playgroundUrlObj = playgroundUrl ? new URL(playgroundUrl) : null;
	let requestUrlObj = playgroundUrlObj
		? new URL(requestObject.url, playgroundUrlObj)
		: new URL(requestObject.url);
	if (requestUrlObj.protocol === 'http:') {
		requestUrlObj.protocol = 'https:';
		const httpsUrl = requestUrlObj.toString();
		requestObject = await cloneRequest(requestObject, { url: httpsUrl });
		requestUrlObj = new URL(httpsUrl);
	}

	// If no CORS proxy URL is provided, just do a direct fetch
	if (!corsProxyUrl) {
		return await fetch(requestObject);
	}

	// Parse the CORS proxy URL to get its hostname
	const corsProxyUrlObj = new URL(corsProxyUrl);

	/**
	 * Never try to proxy requests that are already going through the CORS proxy.
	 * This prevents infinite loops where we'd end up with URLs like:
	 * https://cors-proxy.example.com/?https://cors-proxy.example.com/?https://target.com
	 */
	if (requestUrlObj.hostname === corsProxyUrlObj.hostname) {
		return await fetch(requestObject);
	}

	/**
	 * Never try to proxy requests to the playground itself. The remote proxy
	 * won't be able to reach it. At best, it will produce a cryptic error
	 * message. At worst, it will time out, making the user wait for 30 seconds.
	 */
	if (
		playgroundUrlObj &&
		requestUrlObj.protocol === playgroundUrlObj.protocol &&
		requestUrlObj.hostname === playgroundUrlObj.hostname &&
		requestUrlObj.port === playgroundUrlObj.port &&
		requestUrlObj.pathname.startsWith(playgroundUrlObj.pathname)
	) {
		return await fetch(requestObject);
	}

	/**
	 * Determine if this is an external request (different hostname than playground).
	 * ALL external requests should go through the CORS proxy by default.
	 */
	const isExternalRequest =
		playgroundUrlObj &&
		requestUrlObj.hostname !== playgroundUrlObj.hostname;

	if (isExternalRequest) {
		// If the developer has explicitly allowed the request to pass the
		// credentials headers with the X-Cors-Proxy-Allowed-Request-Headers header,
		// then let's include those credentials in the fetch() request.
		const headers = new Headers(requestObject.headers);
		const corsProxyAllowedHeaders =
			headers.get('x-cors-proxy-allowed-request-headers')?.split(',') ||
			[];
		const requestIntendsToPassCredentials =
			corsProxyAllowedHeaders.includes('authorization') ||
			corsProxyAllowedHeaders.includes('cookie');

		const proxiedRequest = await cloneRequest(requestObject, {
			url: `${corsProxyUrl}${requestObject.url}`,
			...(requestIntendsToPassCredentials && { credentials: 'include' }),
		});

		return await fetch(proxiedRequest, init);
	}

	// For same-origin requests, do a direct fetch
	return await fetch(requestObject);
}
