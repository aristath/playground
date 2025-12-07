<?php
/**
 * HTTP Stream Wrapper that routes requests through CORS proxy.
 *
 * This file is loaded via auto_prepend_file from /internal/shared/preload/
 * and intercepts ALL http:// and https:// requests, rewriting them to go
 * through the CORS proxy.
 *
 * Rewrites URLs like:
 *   https://updates.drupal.org/psa.json
 * To:
 *   https://cors-proxy.altolith.dev/?https://updates.drupal.org/psa.json
 */

if (!defined('PLAYGROUND_CORS_PROXY')) {
    define('PLAYGROUND_CORS_PROXY', 'https://cors-proxy.altolith.dev/?');
}

class PlaygroundHttpStreamWrapper {
    private $position = 0;
    private $data = '';
    private $responseHeaders = [];
    public $context;

    /**
     * Opens the stream by fetching the URL through the CORS proxy.
     */
    public function stream_open($path, $mode, $options, &$opened_path) {
        // Check if networking is enabled
        if (!file_exists('/internal/playground-network-enabled')) {
            return false;
        }

        // Rewrite URL to go through CORS proxy
        $proxyUrl = PLAYGROUND_CORS_PROXY . $path;

        // Use curl to fetch through the proxy
        $ch = curl_init($proxyUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        // Add Origin header for CORS
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Origin: https://altolith.dev'
        ]);

        $response = curl_exec($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false || $httpCode >= 400) {
            if ($options & STREAM_REPORT_ERRORS) {
                trigger_error("Failed to fetch $path via CORS proxy: $error (HTTP $httpCode)", E_USER_WARNING);
            }
            return false;
        }

        // Split headers and body
        $headerText = substr($response, 0, $headerSize);
        $this->data = substr($response, $headerSize);
        $this->position = 0;

        // Parse response headers for $http_response_header
        $this->responseHeaders = [];
        foreach (explode("\r\n", trim($headerText)) as $line) {
            if (!empty($line)) {
                $this->responseHeaders[] = $line;
            }
        }

        // Set $http_response_header global for compatibility
        $GLOBALS['http_response_header'] = $this->responseHeaders;

        return true;
    }

    /**
     * Reads from the stream.
     */
    public function stream_read($count) {
        $chunk = substr($this->data, $this->position, $count);
        $this->position += strlen($chunk);
        return $chunk;
    }

    /**
     * Checks if we're at the end of the stream.
     */
    public function stream_eof() {
        return $this->position >= strlen($this->data);
    }

    /**
     * Returns stream stats.
     */
    public function stream_stat() {
        return [
            'size' => strlen($this->data),
            'mode' => 0100444, // Regular file, read-only
        ];
    }

    /**
     * Closes the stream.
     */
    public function stream_close() {
        $this->data = '';
        $this->position = 0;
        $this->responseHeaders = [];
    }

    /**
     * Seeks within the stream.
     */
    public function stream_seek($offset, $whence = SEEK_SET) {
        switch ($whence) {
            case SEEK_SET:
                $this->position = $offset;
                break;
            case SEEK_CUR:
                $this->position += $offset;
                break;
            case SEEK_END:
                $this->position = strlen($this->data) + $offset;
                break;
            default:
                return false;
        }
        return true;
    }

    /**
     * Returns current position in stream.
     */
    public function stream_tell() {
        return $this->position;
    }

    /**
     * Required for url_stat() calls (file_exists on URLs, etc.)
     */
    public function url_stat($path, $flags) {
        // Return false - we don't support stat on URLs
        return false;
    }
}

// Register the stream wrapper (only if networking is enabled)
if (file_exists('/internal/playground-network-enabled')) {
    // Unregister the built-in wrappers
    @stream_wrapper_unregister('http');
    @stream_wrapper_unregister('https');

    // Register our custom wrapper
    stream_wrapper_register('http', 'PlaygroundHttpStreamWrapper');
    stream_wrapper_register('https', 'PlaygroundHttpStreamWrapper');
}
