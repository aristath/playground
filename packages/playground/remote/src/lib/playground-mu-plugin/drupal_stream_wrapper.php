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

error_log('[DRUPAL:php:stream_wrapper] ===== FILE LOADED =====');
error_log('[DRUPAL:php:stream_wrapper] PHP_VERSION: ' . PHP_VERSION);
error_log('[DRUPAL:php:stream_wrapper] Network enabled: ' . (file_exists('/internal/playground-network-enabled') ? 'YES' : 'NO'));

if (!defined('PLAYGROUND_CORS_PROXY')) {
    define('PLAYGROUND_CORS_PROXY', 'https://cors-proxy.altolith.dev/?');
}
error_log('[DRUPAL:php:stream_wrapper] CORS_PROXY: ' . PLAYGROUND_CORS_PROXY);

class PlaygroundHttpStreamWrapper {
    private $position = 0;
    private $data = '';
    private $responseHeaders = [];
    public $context;

    /**
     * Opens the stream by fetching the URL through the CORS proxy.
     */
    public function stream_open($path, $mode, $options, &$opened_path) {
        error_log('[DRUPAL:php:stream:stream_open] ========== START ==========');
        error_log('[DRUPAL:php:stream:stream_open] path: ' . $path);
        error_log('[DRUPAL:php:stream:stream_open] mode: ' . $mode);
        error_log('[DRUPAL:php:stream:stream_open] options: ' . $options);

        // Check if networking is enabled
        $networkEnabled = file_exists('/internal/playground-network-enabled');
        error_log('[DRUPAL:php:stream:stream_open] Network enabled: ' . ($networkEnabled ? 'YES' : 'NO'));
        if (!$networkEnabled) {
            error_log('[DRUPAL:php:stream:stream_open] RETURN FALSE: Networking disabled');
            return false;
        }

        // Rewrite URL to go through CORS proxy
        $proxyUrl = PLAYGROUND_CORS_PROXY . $path;
        error_log('[DRUPAL:php:stream:stream_open] Proxy URL: ' . $proxyUrl);

        // Use curl to fetch through the proxy
        error_log('[DRUPAL:php:stream:stream_open] Initializing curl...');
        $ch = curl_init($proxyUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        // Add Origin header for CORS
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Origin: https://altolith.dev'
        ]);

        error_log('[DRUPAL:php:stream:stream_open] Executing curl...');
        $response = curl_exec($ch);
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        error_log('[DRUPAL:php:stream:stream_open] Response received');
        error_log('[DRUPAL:php:stream:stream_open] HTTP code: ' . $httpCode);
        error_log('[DRUPAL:php:stream:stream_open] Header size: ' . $headerSize);
        error_log('[DRUPAL:php:stream:stream_open] Response length: ' . ($response !== false ? strlen($response) : 'FALSE'));
        error_log('[DRUPAL:php:stream:stream_open] Error: ' . ($error ?: 'none'));

        if ($response === false || $httpCode >= 400) {
            error_log('[DRUPAL:php:stream:stream_open] RETURN FALSE: Request failed');
            if ($options & STREAM_REPORT_ERRORS) {
                trigger_error("Failed to fetch $path via CORS proxy: $error (HTTP $httpCode)", E_USER_WARNING);
            }
            return false;
        }

        // Split headers and body
        $headerText = substr($response, 0, $headerSize);
        $this->data = substr($response, $headerSize);
        $this->position = 0;
        error_log('[DRUPAL:php:stream:stream_open] Body length: ' . strlen($this->data));

        // Parse response headers for $http_response_header
        $this->responseHeaders = [];
        foreach (explode("\r\n", trim($headerText)) as $line) {
            if (!empty($line)) {
                $this->responseHeaders[] = $line;
            }
        }
        error_log('[DRUPAL:php:stream:stream_open] Parsed headers count: ' . count($this->responseHeaders));

        // Set $http_response_header global for compatibility
        $GLOBALS['http_response_header'] = $this->responseHeaders;

        error_log('[DRUPAL:php:stream:stream_open] ========== END (SUCCESS) ==========');
        return true;
    }

    /**
     * Reads from the stream.
     */
    public function stream_read($count) {
        error_log('[DRUPAL:php:stream:stream_read] count: ' . $count . ', position: ' . $this->position . ', data_len: ' . strlen($this->data));
        $chunk = substr($this->data, $this->position, $count);
        $this->position += strlen($chunk);
        error_log('[DRUPAL:php:stream:stream_read] chunk_len: ' . strlen($chunk) . ', new_position: ' . $this->position);
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
error_log('[DRUPAL:php:stream_wrapper] Checking if should register wrappers...');
if (file_exists('/internal/playground-network-enabled')) {
    error_log('[DRUPAL:php:stream_wrapper] Network enabled, registering wrappers...');
    // Unregister the built-in wrappers
    $http_unreg = @stream_wrapper_unregister('http');
    $https_unreg = @stream_wrapper_unregister('https');
    error_log('[DRUPAL:php:stream_wrapper] Unregistered http: ' . ($http_unreg ? 'YES' : 'NO'));
    error_log('[DRUPAL:php:stream_wrapper] Unregistered https: ' . ($https_unreg ? 'YES' : 'NO'));

    // Register our custom wrapper
    $http_reg = stream_wrapper_register('http', 'PlaygroundHttpStreamWrapper');
    $https_reg = stream_wrapper_register('https', 'PlaygroundHttpStreamWrapper');
    error_log('[DRUPAL:php:stream_wrapper] Registered http: ' . ($http_reg ? 'YES' : 'NO'));
    error_log('[DRUPAL:php:stream_wrapper] Registered https: ' . ($https_reg ? 'YES' : 'NO'));
    error_log('[DRUPAL:php:stream_wrapper] Stream wrappers registered successfully');
} else {
    error_log('[DRUPAL:php:stream_wrapper] Network NOT enabled, skipping wrapper registration');
}
