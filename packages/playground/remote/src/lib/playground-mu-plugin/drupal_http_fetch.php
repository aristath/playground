<?php
/**
 * Custom Guzzle handler for Drupal in WordPress Playground.
 *
 * This handler routes all HTTP requests through JavaScript using post_message_to_js(),
 * which allows the Playground to handle CORS and proxy the requests as needed.
 *
 * The JavaScript side receives requests as JSON messages with the format:
 * {
 *     "type": "request",
 *     "data": {
 *         "url": "https://example.com/api",
 *         "method": "GET",
 *         "headers": {"Accept": "application/json"},
 *         "data": ""
 *     }
 * }
 *
 * And returns raw HTTP responses like:
 * HTTP/1.1 200 OK
 * Content-Type: application/json
 *
 * {"result": "data"}
 */

error_log('[DRUPAL:php:http_fetch] ===== FILE LOADED =====');
error_log('[DRUPAL:php:http_fetch] PHP_VERSION: ' . PHP_VERSION);
error_log('[DRUPAL:php:http_fetch] CWD: ' . getcwd());
error_log('[DRUPAL:php:http_fetch] Network enabled flag: ' . (file_exists('/internal/playground-network-enabled') ? 'YES' : 'NO'));

use GuzzleHttp\Promise\FulfilledPromise;
use GuzzleHttp\Promise\RejectedPromise;
use GuzzleHttp\Psr7\Response;
use Psr\Http\Message\RequestInterface;

/**
 * Guzzle handler that routes requests through JavaScript.
 */
class PlaygroundGuzzleHandler
{
    /**
     * Invoke the handler.
     *
     * @param RequestInterface $request The request to send.
     * @param array $options Request options.
     * @return \GuzzleHttp\Promise\PromiseInterface
     */
    public function __invoke(RequestInterface $request, array $options)
    {
        error_log('[DRUPAL:php:GuzzleHandler] ========== __invoke START ==========');
        error_log('[DRUPAL:php:GuzzleHandler] Request URI: ' . (string) $request->getUri());
        error_log('[DRUPAL:php:GuzzleHandler] Request method: ' . $request->getMethod());
        error_log('[DRUPAL:php:GuzzleHandler] Options: ' . json_encode(array_keys($options)));

        // Check if networking is enabled
        $networkEnabled = file_exists('/internal/playground-network-enabled');
        error_log('[DRUPAL:php:GuzzleHandler] Network enabled: ' . ($networkEnabled ? 'YES' : 'NO'));
        if (!$networkEnabled) {
            error_log('[DRUPAL:php:GuzzleHandler] REJECTED: Networking disabled');
            return new RejectedPromise(
                new \Exception('Networking is disabled in Playground')
            );
        }

        // Check if post_message_to_js function exists
        $hasPostMessage = function_exists('post_message_to_js');
        error_log('[DRUPAL:php:GuzzleHandler] post_message_to_js exists: ' . ($hasPostMessage ? 'YES' : 'NO'));
        if (!$hasPostMessage) {
            error_log('[DRUPAL:php:GuzzleHandler] REJECTED: post_message_to_js not available');
            return new RejectedPromise(
                new \Exception('post_message_to_js function not available')
            );
        }

        try {
            // Flatten headers (Guzzle uses arrays for header values)
            $headers = [];
            foreach ($request->getHeaders() as $name => $values) {
                $headers[$name] = implode(', ', $values);
            }
            error_log('[DRUPAL:php:GuzzleHandler] Request headers: ' . json_encode($headers));

            // Build the request message
            $message = json_encode([
                'type' => 'request',
                'data' => [
                    'url' => (string) $request->getUri(),
                    'method' => $request->getMethod(),
                    'headers' => $headers,
                    'data' => (string) $request->getBody(),
                ]
            ]);
            error_log('[DRUPAL:php:GuzzleHandler] Message length: ' . strlen($message));
            error_log('[DRUPAL:php:GuzzleHandler] Message preview: ' . substr($message, 0, 500));

            // Send to JavaScript and get raw HTTP response
            error_log('[DRUPAL:php:GuzzleHandler] Calling post_message_to_js...');
            $rawResponse = post_message_to_js($message);
            error_log('[DRUPAL:php:GuzzleHandler] Response received, length: ' . strlen($rawResponse));
            error_log('[DRUPAL:php:GuzzleHandler] Response preview: ' . substr($rawResponse, 0, 500));

            if (empty($rawResponse)) {
                error_log('[DRUPAL:php:GuzzleHandler] REJECTED: Empty response');
                return new RejectedPromise(
                    new \Exception('Empty response from JavaScript handler')
                );
            }

            // Parse the raw HTTP response
            error_log('[DRUPAL:php:GuzzleHandler] Parsing raw HTTP response...');
            $response = $this->parseRawHttpResponse($rawResponse);
            error_log('[DRUPAL:php:GuzzleHandler] Parsed response status: ' . $response->getStatusCode());
            error_log('[DRUPAL:php:GuzzleHandler] ========== __invoke END (SUCCESS) ==========');

            return new FulfilledPromise($response);
        } catch (\Exception $e) {
            error_log('[DRUPAL:php:GuzzleHandler] EXCEPTION: ' . $e->getMessage());
            error_log('[DRUPAL:php:GuzzleHandler] EXCEPTION trace: ' . $e->getTraceAsString());
            error_log('[DRUPAL:php:GuzzleHandler] ========== __invoke END (EXCEPTION) ==========');
            return new RejectedPromise($e);
        }
    }

    /**
     * Parse a raw HTTP response string into a Guzzle Response object.
     *
     * @param string $rawResponse Raw HTTP response with headers and body.
     * @return Response
     */
    private function parseRawHttpResponse($rawResponse)
    {
        error_log('[DRUPAL:php:parseRawHttpResponse] ========== START ==========');
        error_log('[DRUPAL:php:parseRawHttpResponse] Raw response length: ' . strlen($rawResponse));

        // Split headers and body
        $parts = explode("\r\n\r\n", $rawResponse, 2);
        $headerSection = $parts[0] ?? '';
        $body = $parts[1] ?? '';
        error_log('[DRUPAL:php:parseRawHttpResponse] Header section length: ' . strlen($headerSection));
        error_log('[DRUPAL:php:parseRawHttpResponse] Body length: ' . strlen($body));

        // Parse status line and headers
        $lines = explode("\r\n", $headerSection);
        $statusLine = array_shift($lines);
        error_log('[DRUPAL:php:parseRawHttpResponse] Status line: ' . $statusLine);

        // Parse status code from "HTTP/1.1 200 OK"
        $statusCode = 200;
        $reasonPhrase = 'OK';
        if (preg_match('/^HTTP\/[\d.]+ (\d+)\s*(.*)$/i', $statusLine, $matches)) {
            $statusCode = (int) $matches[1];
            $reasonPhrase = trim($matches[2]);
        }
        error_log('[DRUPAL:php:parseRawHttpResponse] Parsed status code: ' . $statusCode);
        error_log('[DRUPAL:php:parseRawHttpResponse] Parsed reason phrase: ' . $reasonPhrase);

        // Parse headers
        $headers = [];
        foreach ($lines as $line) {
            if (strpos($line, ':') !== false) {
                list($name, $value) = explode(':', $line, 2);
                $name = trim($name);
                $value = trim($value);
                if (!isset($headers[$name])) {
                    $headers[$name] = [];
                }
                $headers[$name][] = $value;
            }
        }
        error_log('[DRUPAL:php:parseRawHttpResponse] Parsed headers count: ' . count($headers));
        error_log('[DRUPAL:php:parseRawHttpResponse] Parsed headers: ' . json_encode(array_keys($headers)));
        error_log('[DRUPAL:php:parseRawHttpResponse] ========== END ==========');

        return new Response($statusCode, $headers, $body, '1.1', $reasonPhrase);
    }
}

/**
 * Create a handler stack with the Playground handler.
 *
 * This function can be used to configure Drupal's HTTP client.
 *
 * @return callable The Guzzle handler.
 */
function playground_create_guzzle_handler()
{
    error_log('[DRUPAL:php:playground_create_guzzle_handler] Creating new PlaygroundGuzzleHandler instance');
    return new PlaygroundGuzzleHandler();
}
