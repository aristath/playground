import type { PHP } from '@php-wasm/universal';
import { joinPaths } from '@php-wasm/util';

export interface DrupalSettingsOptions {
	/** The site URL (used for trusted host patterns) */
	siteUrl: string;
	/** Custom hash salt (will be generated if not provided) */
	hashSalt?: string;
	/** Path to the SQLite database file (relative to sites/default/files) */
	databasePath?: string;
}

/**
 * Generates a random hash salt for Drupal.
 */
function generateHashSalt(): string {
	const chars =
		'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
	let result = '';
	for (let i = 0; i < 74; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * Creates the settings.php content for Drupal with SQLite configuration.
 *
 * Drupal 9+ has built-in SQLite support, so no external plugin is needed
 * (unlike WordPress which requires the sqlite-database-integration plugin).
 */
export function generateSettingsPhp(options: DrupalSettingsOptions): string {
	const hashSalt = options.hashSalt || generateHashSalt();
	const databasePath = options.databasePath || '.ht.sqlite';

	// Extract hostname for trusted_host_patterns
	let hostname = '*';
	try {
		const url = new URL(options.siteUrl);
		hostname = url.hostname.replace(/\./g, '\\.');
	} catch {
		// If URL parsing fails, use a permissive pattern
	}

	return `<?php

/**
 * Drupal settings for WordPress Playground.
 *
 * This file is auto-generated for SQLite support in the browser.
 */

/**
 * Database configuration - SQLite
 *
 * Drupal has built-in SQLite support since Drupal 8.
 * The database file is stored in sites/default/files/.ht.sqlite
 * (the .ht prefix prevents direct download in Apache).
 */
$databases['default']['default'] = [
  'driver' => 'sqlite',
  'database' => 'sites/default/files/${databasePath}',
];

/**
 * Hash salt for security.
 * This is used for one-time login links, form tokens, etc.
 */
$settings['hash_salt'] = '${hashSalt}';

/**
 * Trusted host patterns.
 * In a browser environment, we trust all hosts since the site
 * runs locally in a sandboxed environment.
 */
$settings['trusted_host_patterns'] = [
  '^${hostname}$',
  '^localhost$',
  '^127\\.0\\.0\\.1$',
  '.*',  // Allow all hosts in sandbox environment
];

/**
 * Configuration sync directory.
 * This is where exported configuration is stored.
 */
$settings['config_sync_directory'] = 'sites/default/files/config_sync';

/**
 * File paths.
 */
$settings['file_public_path'] = 'sites/default/files';
$settings['file_private_path'] = 'sites/default/files/private';
$settings['file_temp_path'] = '/tmp';

/**
 * Performance settings for browser environment.
 */
$config['system.performance']['css']['preprocess'] = FALSE;
$config['system.performance']['js']['preprocess'] = FALSE;

/**
 * Error reporting - show all errors in development.
 */
$config['system.logging']['error_level'] = 'verbose';

/**
 * Skip file system permission checks.
 * In a WebAssembly environment, these checks don't apply.
 */
$settings['skip_permissions_hardening'] = TRUE;

/**
 * Base URL - will be set dynamically by PHP.
 */
// \$base_url is set via the SCRIPT_NAME and host headers

/**
 * Session settings.
 */
ini_set('session.gc_probability', 1);
ini_set('session.gc_divisor', 100);
ini_set('session.gc_maxlifetime', 200000);
ini_set('session.cookie_lifetime', 2000000);

/**
 * Increase memory limit for Drupal.
 * Drupal typically needs more memory than WordPress.
 */
ini_set('memory_limit', '256M');

`;
}

/**
 * Writes the settings.php file to the Drupal installation.
 */
export async function writeSettingsPhp(
	php: PHP,
	documentRoot: string,
	options: DrupalSettingsOptions
): Promise<void> {
	const settingsDir = joinPaths(documentRoot, 'sites/default');
	const settingsPath = joinPaths(settingsDir, 'settings.php');

	// Create the sites/default directory if it doesn't exist
	if (!php.isDir(settingsDir)) {
		php.mkdir(settingsDir);
	}

	// Create the files directory for the SQLite database
	const filesDir = joinPaths(settingsDir, 'files');
	if (!php.isDir(filesDir)) {
		php.mkdir(filesDir);
	}

	// Create config_sync directory
	const configSyncDir = joinPaths(filesDir, 'config_sync');
	if (!php.isDir(configSyncDir)) {
		php.mkdir(configSyncDir);
	}

	// Create private files directory
	const privateDir = joinPaths(filesDir, 'private');
	if (!php.isDir(privateDir)) {
		php.mkdir(privateDir);
	}

	// Write the settings.php file
	const settingsContent = generateSettingsPhp(options);
	php.writeFile(settingsPath, settingsContent);
}

/**
 * Creates a services.yml file with development settings.
 */
export function generateServicesYml(): string {
	return `parameters:
  session.storage.options:
    gc_probability: 1
    gc_divisor: 100
    gc_maxlifetime: 200000
    cookie_lifetime: 2000000
  twig.config:
    debug: true
    auto_reload: true
    cache: false
services:
  cache.backend.null:
    class: Drupal\\Core\\Cache\\NullBackendFactory
`;
}

/**
 * Writes the services.yml file for development settings.
 */
export async function writeServicesYml(
	php: PHP,
	documentRoot: string
): Promise<void> {
	const servicesPath = joinPaths(documentRoot, 'sites/default/services.yml');
	const servicesContent = generateServicesYml();
	php.writeFile(servicesPath, servicesContent);
}
