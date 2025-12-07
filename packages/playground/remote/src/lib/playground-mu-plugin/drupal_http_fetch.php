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
        // Check if networking is enabled
        if (!file_exists('/internal/playground-network-enabled')) {
            return new RejectedPromise(
                new \Exception('Networking is disabled in Playground')
            );
        }

        // Check if post_message_to_js function exists
        if (!function_exists('post_message_to_js')) {
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

            // Send to JavaScript and get raw HTTP response
            $rawResponse = post_message_to_js($message);

            if (empty($rawResponse)) {
                return new RejectedPromise(
                    new \Exception('Empty response from JavaScript handler')
                );
            }

            // Parse the raw HTTP response
            $response = $this->parseRawHttpResponse($rawResponse);

            return new FulfilledPromise($response);
        } catch (\Exception $e) {
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
        // Split headers and body
        $parts = explode("\r\n\r\n", $rawResponse, 2);
        $headerSection = $parts[0] ?? '';
        $body = $parts[1] ?? '';

        // Parse status line and headers
        $lines = explode("\r\n", $headerSection);
        $statusLine = array_shift($lines);

        // Parse status code from "HTTP/1.1 200 OK"
        $statusCode = 200;
        $reasonPhrase = 'OK';
        if (preg_match('/^HTTP\/[\d.]+ (\d+)\s*(.*)$/i', $statusLine, $matches)) {
            $statusCode = (int) $matches[1];
            $reasonPhrase = trim($matches[2]);
        }

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
    return new PlaygroundGuzzleHandler();
}
