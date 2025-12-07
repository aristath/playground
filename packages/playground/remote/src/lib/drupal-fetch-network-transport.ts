import { logger } from '@php-wasm/logger';
import type { UniversalPHP } from '@php-wasm/universal';
import { fetchWithCorsProxy } from '@php-wasm/web';

export interface RequestData {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	data?: string;
}

export interface RequestMessage {
	type: 'request';
	data: RequestData;
}

export interface SetupFetchNetworkTransportOptions {
	corsProxyUrl?: string;
}

/**
 * Allow Drupal to make network requests via the fetch API.
 * On the Drupal side, this is handled by a custom Guzzle handler
 * that sends requests as JSON messages via post_message_to_js().
 *
 * This class sets up the JavaScript-side message handler that:
 * 1. Receives request messages from PHP
 * 2. Makes the actual HTTP request using fetchWithCorsProxy
 * 3. Returns the response to PHP in raw HTTP format
 *
 * Usage:
 *
 * ```ts
 * const transport = new DrupalFetchNetworkTransport({ corsProxyUrl: '...' });
 * await transport.setupMessageHandler(php);
 * await transport.setEnabled(php, true);
 * ```
 */
export class DrupalFetchNetworkTransport {
	private options: SetupFetchNetworkTransportOptions;

	constructor(options?: SetupFetchNetworkTransportOptions) {
		this.options = options || {};
	}

	/**
	 * Enable or disable network requests.
	 * This writes a flag that the PHP Guzzle handler checks.
	 */
	async setEnabled(
		playground: UniversalPHP,
		enabled: boolean
	): Promise<void> {
		// Write a flag file that the Guzzle handler will check
		const flagPath = '/internal/playground-network-enabled';
		if (enabled) {
			playground.writeFile(flagPath, '1');
		} else {
			if (playground.fileExists(flagPath)) {
				playground.unlink(flagPath);
			}
		}
	}

	/**
	 * Set up the message handler for network requests.
	 * This intercepts JSON messages from PHP and makes actual HTTP requests.
	 */
	async setupMessageHandler(playground: UniversalPHP) {
		return await playground.onMessage(async (message: string) => {
			let envelope: RequestMessage;
			try {
				// PHP-WASM sends messages as strings, so we can't expect valid JSON.
				envelope = JSON.parse(message);
			} catch {
				return '';
			}
			const { type, data } = envelope;
			if (type !== 'request') {
				return '';
			}

			// PHP encodes empty arrays as JSON arrays, not objects.
			// We can't easily reason about the request body, but we know
			// headers should be an object so let's convert it here.
			if (!data.headers) {
				data.headers = {};
			} else if (Array.isArray(data.headers)) {
				data.headers = Object.fromEntries(data.headers);
			}

			// Hardcode known values - don't rely on dynamic resolution
			// which might fail in web worker context (blob URLs, etc.)
			const corsProxyUrl = 'https://cors-proxy.altolith.dev/?';
			const playgroundUrl = 'https://altolith.dev/';

			return handleRequest(data, (url: any, options: any) =>
				fetchWithCorsProxy(url, options, corsProxyUrl, playgroundUrl)
			);
		});
	}
}

export async function handleRequest(data: RequestData, fetchFn = fetch) {
	let response;
	try {
		const fetchMethod = data.method || 'GET';
		const fetchHeaders = data.headers || {};

		const hasContentTypeHeader = Object.keys(fetchHeaders).some(
			(name) => name.toLowerCase() === 'content-type'
		);

		if (fetchMethod == 'POST' && !hasContentTypeHeader) {
			fetchHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
		}

		logger.debug(`[Drupal Network] ${fetchMethod} ${data.url}`);

		response = await fetchFn(data.url, {
			method: fetchMethod,
			headers: fetchHeaders,
			body: fetchMethod === 'GET' ? undefined : data.data,
			credentials: 'omit',
		});
	} catch (error) {
		logger.warn(`[Drupal Network] Request failed: ${data.url}`, error);
		return new TextEncoder().encode(
			`HTTP/1.1 400 Invalid Request\r\ncontent-type: text/plain\r\n\r\nPlayground could not serve the request.`
		);
	}

	const responseHeaders: string[] = [];
	response.headers.forEach((value, key) => {
		responseHeaders.push(key + ': ' + value);
	});

	/*
	 * Technically we should only send ASCII here and ensure we don't send control
	 * characters or newlines. We ought to be very careful with HTTP headers since
	 * some attacks rely on assumed processing of them to let things slip in that
	 * would end the headers section before its done.
	 *
	 * That being said, the browser takes care of it for us.
	 * response.headers is an instance of the Headers class, and you just can't
	 * construct the Headers instance if the values are malformed.
	 */
	const headersText =
		[
			'HTTP/1.1 ' + response.status + ' ' + response.statusText,
			...responseHeaders,
		].join('\r\n') + `\r\n\r\n`;
	const headersBuffer = new TextEncoder().encode(headersText);
	const bodyBuffer = new Uint8Array(await response.arrayBuffer());
	const jointBuffer = new Uint8Array(
		headersBuffer.byteLength + bodyBuffer.byteLength
	);
	jointBuffer.set(headersBuffer);
	jointBuffer.set(bodyBuffer, headersBuffer.byteLength);

	return jointBuffer;
}
