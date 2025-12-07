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
		console.log(
			'🌐 [DRUPAL:network:constructor] ========== CONSTRUCTOR =========='
		);
		console.log(
			'🌐 [DRUPAL:network:constructor] options:',
			JSON.stringify(options)
		);
		this.options = options || {};
		console.log(
			'🌐 [DRUPAL:network:constructor] this.options:',
			JSON.stringify(this.options)
		);
	}

	/**
	 * Enable or disable network requests.
	 * This writes a flag that the PHP Guzzle handler checks.
	 */
	async setEnabled(
		playground: UniversalPHP,
		enabled: boolean
	): Promise<void> {
		console.log(
			'🌐 [DRUPAL:network:setEnabled] ========== START =========='
		);
		console.log('🌐 [DRUPAL:network:setEnabled] enabled:', enabled);
		// Write a flag file that the Guzzle handler will check
		const flagPath = '/internal/playground-network-enabled';
		console.log('🌐 [DRUPAL:network:setEnabled] flagPath:', flagPath);
		if (enabled) {
			console.log('🌐 [DRUPAL:network:setEnabled] Writing flag file...');
			playground.writeFile(flagPath, '1');
			console.log('🌐 [DRUPAL:network:setEnabled] Flag file written');
			// Verify
			const exists = playground.fileExists(flagPath);
			console.log(
				'🌐 [DRUPAL:network:setEnabled] Verification - exists:',
				exists
			);
		} else {
			console.log('🌐 [DRUPAL:network:setEnabled] Removing flag file...');
			if (playground.fileExists(flagPath)) {
				playground.unlink(flagPath);
				console.log('🌐 [DRUPAL:network:setEnabled] Flag file removed');
			} else {
				console.log(
					'🌐 [DRUPAL:network:setEnabled] Flag file did not exist'
				);
			}
		}
		console.log('🌐 [DRUPAL:network:setEnabled] ========== END ==========');
	}

	/**
	 * Set up the message handler for network requests.
	 * This intercepts JSON messages from PHP and makes actual HTTP requests.
	 */
	async setupMessageHandler(playground: UniversalPHP) {
		console.log(
			'🌐 [DRUPAL:network:setupMessageHandler] ========== START =========='
		);
		console.log(
			'🌐 [DRUPAL:network:setupMessageHandler] Setting up onMessage handler...'
		);

		const result = await playground.onMessage(async (message: string) => {
			console.log(
				'🌐 [DRUPAL:network:onMessage] ========== MESSAGE RECEIVED =========='
			);
			console.log(
				'🌐 [DRUPAL:network:onMessage] message length:',
				message.length
			);
			console.log(
				'🌐 [DRUPAL:network:onMessage] message preview:',
				message.substring(0, 500)
			);

			let envelope: RequestMessage;
			try {
				// PHP-WASM sends messages as strings, so we can't expect valid JSON.
				envelope = JSON.parse(message);
				console.log(
					'🌐 [DRUPAL:network:onMessage] Parsed envelope type:',
					envelope.type
				);
			} catch (e) {
				console.log(
					'🌐 [DRUPAL:network:onMessage] JSON parse failed:',
					e
				);
				return '';
			}
			const { type, data } = envelope;
			if (type !== 'request') {
				console.log(
					'🌐 [DRUPAL:network:onMessage] Not a request type, ignoring'
				);
				return '';
			}

			console.log(
				'🌐 [DRUPAL:network:onMessage] Request data:',
				JSON.stringify({
					url: data.url,
					method: data.method,
					headersCount: Object.keys(data.headers || {}).length,
					dataLength: (data.data || '').length,
				})
			);

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

			console.log(
				'🌐 [DRUPAL:network:onMessage] Making fetch request...'
			);
			console.log(
				'🌐 [DRUPAL:network:onMessage] corsProxyUrl:',
				corsProxyUrl
			);
			console.log(
				'🌐 [DRUPAL:network:onMessage] playgroundUrl:',
				playgroundUrl
			);

			const response = await handleRequest(
				data,
				(url: any, options: any) =>
					fetchWithCorsProxy(
						url,
						options,
						corsProxyUrl,
						playgroundUrl
					)
			);

			console.log(
				'🌐 [DRUPAL:network:onMessage] Response received, length:',
				response.length
			);
			console.log(
				'🌐 [DRUPAL:network:onMessage] Response preview:',
				new TextDecoder().decode(response.slice(0, 500))
			);
			console.log(
				'🌐 [DRUPAL:network:onMessage] ========== MESSAGE END =========='
			);

			return response;
		});

		console.log(
			'🌐 [DRUPAL:network:setupMessageHandler] Handler registered'
		);
		console.log(
			'🌐 [DRUPAL:network:setupMessageHandler] ========== END =========='
		);
		return result;
	}
}

export async function handleRequest(data: RequestData, fetchFn = fetch) {
	console.log('🌐 [DRUPAL:handleRequest] ========== START ==========');
	console.log('🌐 [DRUPAL:handleRequest] data.url:', data.url);
	console.log('🌐 [DRUPAL:handleRequest] data.method:', data.method);
	console.log(
		'🌐 [DRUPAL:handleRequest] data.headers:',
		JSON.stringify(data.headers)
	);
	console.log(
		'🌐 [DRUPAL:handleRequest] data.data length:',
		(data.data || '').length
	);

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

		console.log('🌐 [DRUPAL:handleRequest] fetchMethod:', fetchMethod);
		console.log(
			'🌐 [DRUPAL:handleRequest] fetchHeaders:',
			JSON.stringify(fetchHeaders)
		);
		logger.debug(`[Drupal Network] ${fetchMethod} ${data.url}`);

		console.log('🌐 [DRUPAL:handleRequest] Calling fetchFn...');
		response = await fetchFn(data.url, {
			method: fetchMethod,
			headers: fetchHeaders,
			body: fetchMethod === 'GET' ? undefined : data.data,
			credentials: 'omit',
		});
		console.log(
			'🌐 [DRUPAL:handleRequest] fetchFn returned, status:',
			response.status
		);
	} catch (error) {
		console.log('🌐 [DRUPAL:handleRequest] FETCH ERROR:', error);
		logger.warn(`[Drupal Network] Request failed: ${data.url}`, error);
		return new TextEncoder().encode(
			`HTTP/1.1 400 Invalid Request\r\ncontent-type: text/plain\r\n\r\nPlayground could not serve the request.`
		);
	}

	const responseHeaders: string[] = [];
	response.headers.forEach((value, key) => {
		responseHeaders.push(key + ': ' + value);
	});
	console.log(
		'🌐 [DRUPAL:handleRequest] responseHeaders count:',
		responseHeaders.length
	);

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
