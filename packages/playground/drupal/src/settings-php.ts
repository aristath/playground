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
	console.log(
		'📝 [DRUPAL:settings:generateHashSalt] Generating hash salt...'
	);
	const chars =
		'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-';
	let result = '';
	for (let i = 0; i < 74; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	console.log(
		'📝 [DRUPAL:settings:generateHashSalt] Generated salt length:',
		result.length
	);
	return result;
}

/**
 * Creates the settings.php content for Drupal with SQLite configuration.
 *
 * Drupal 9+ has built-in SQLite support, so no external plugin is needed
 * (unlike WordPress which requires the sqlite-database-integration plugin).
 */
export function generateSettingsPhp(options: DrupalSettingsOptions): string {
	console.log(
		'📝 [DRUPAL:settings:generateSettingsPhp] ========== START =========='
	);
	console.log(
		'📝 [DRUPAL:settings:generateSettingsPhp] options:',
		JSON.stringify({
			siteUrl: options.siteUrl,
			hasHashSalt: !!options.hashSalt,
			databasePath: options.databasePath,
		})
	);

	const hashSalt = options.hashSalt || generateHashSalt();
	const databasePath = options.databasePath || '.ht.sqlite';

	console.log(
		'📝 [DRUPAL:settings:generateSettingsPhp] hashSalt length:',
		hashSalt.length
	);
	console.log(
		'📝 [DRUPAL:settings:generateSettingsPhp] databasePath:',
		databasePath
	);

	// Extract hostname for trusted_host_patterns
	let hostname = '*';
	try {
		const url = new URL(options.siteUrl);
		hostname = url.hostname.replace(/\./g, '\\.');
		console.log(
			'📝 [DRUPAL:settings:generateSettingsPhp] Parsed hostname:',
			hostname
		);
	} catch (e) {
		console.log(
			'📝 [DRUPAL:settings:generateSettingsPhp] Failed to parse URL:',
			e
		);
		// If URL parsing fails, use a permissive pattern
	}

	const content = `<?php

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

/**
 * Custom HTTP client configuration for Playground.
 *
 * This configures Guzzle to use a custom handler that routes all HTTP
 * requests through JavaScript, enabling CORS proxy support.
 */
if (file_exists('/internal/shared/drupal-includes/drupal_http_fetch.php')) {
  require_once '/internal/shared/drupal-includes/drupal_http_fetch.php';
  $settings['http_client_config'] = [
    'handler' => playground_create_guzzle_handler(),
  ];
}

`;

	console.log(
		'📝 [DRUPAL:settings:generateSettingsPhp] Generated content length:',
		content.length
	);
	console.log(
		'📝 [DRUPAL:settings:generateSettingsPhp] ========== END =========='
	);
	return content;
}

/**
 * Writes the settings.php file to the Drupal installation.
 */
export async function writeSettingsPhp(
	php: PHP,
	documentRoot: string,
	options: DrupalSettingsOptions
): Promise<void> {
	console.log('📝 [DRUPAL:writeSettingsPhp] ========== START ==========');
	console.log(
		'📝 [DRUPAL:writeSettingsPhp] php.documentRoot:',
		php.documentRoot
	);
	console.log(
		'📝 [DRUPAL:writeSettingsPhp] documentRoot param:',
		documentRoot
	);
	console.log(
		'📝 [DRUPAL:writeSettingsPhp] options:',
		JSON.stringify(options)
	);

	const settingsDir = joinPaths(documentRoot, 'sites/default');
	const settingsPath = joinPaths(settingsDir, 'settings.php');

	console.log('📝 [DRUPAL:writeSettingsPhp] settingsDir:', settingsDir);
	console.log('📝 [DRUPAL:writeSettingsPhp] settingsPath:', settingsPath);

	// Create the sites/default directory if it doesn't exist
	console.log(
		'📝 [DRUPAL:writeSettingsPhp] Checking settingsDir exists:',
		php.isDir(settingsDir)
	);
	if (!php.isDir(settingsDir)) {
		console.log('📝 [DRUPAL:writeSettingsPhp] Creating settingsDir...');
		php.mkdir(settingsDir);
		console.log('📝 [DRUPAL:writeSettingsPhp] settingsDir created');
	}

	// Create the files directory for the SQLite database
	const filesDir = joinPaths(settingsDir, 'files');
	console.log('📝 [DRUPAL:writeSettingsPhp] filesDir:', filesDir);
	console.log(
		'📝 [DRUPAL:writeSettingsPhp] Checking filesDir exists:',
		php.isDir(filesDir)
	);
	if (!php.isDir(filesDir)) {
		console.log('📝 [DRUPAL:writeSettingsPhp] Creating filesDir...');
		php.mkdir(filesDir);
		console.log('📝 [DRUPAL:writeSettingsPhp] filesDir created');
	}

	// Create config_sync directory
	const configSyncDir = joinPaths(filesDir, 'config_sync');
	console.log('📝 [DRUPAL:writeSettingsPhp] configSyncDir:', configSyncDir);
	if (!php.isDir(configSyncDir)) {
		console.log('📝 [DRUPAL:writeSettingsPhp] Creating configSyncDir...');
		php.mkdir(configSyncDir);
		console.log('📝 [DRUPAL:writeSettingsPhp] configSyncDir created');
	}

	// Create private files directory
	const privateDir = joinPaths(filesDir, 'private');
	console.log('📝 [DRUPAL:writeSettingsPhp] privateDir:', privateDir);
	if (!php.isDir(privateDir)) {
		console.log('📝 [DRUPAL:writeSettingsPhp] Creating privateDir...');
		php.mkdir(privateDir);
		console.log('📝 [DRUPAL:writeSettingsPhp] privateDir created');
	}

	// Write the settings.php file
	console.log('📝 [DRUPAL:writeSettingsPhp] Generating settings content...');
	const settingsContent = generateSettingsPhp(options);
	console.log(
		'📝 [DRUPAL:writeSettingsPhp] Content generated, length:',
		settingsContent.length
	);
	console.log(
		'📝 [DRUPAL:writeSettingsPhp] First 300 chars:',
		settingsContent.substring(0, 300)
	);

	console.log('📝 [DRUPAL:writeSettingsPhp] Writing file to:', settingsPath);
	php.writeFile(settingsPath, settingsContent);
	console.log('📝 [DRUPAL:writeSettingsPhp] File written');

	// Verify the write
	const exists = php.fileExists(settingsPath);
	console.log(
		'📝 [DRUPAL:writeSettingsPhp] Verification - file exists:',
		exists
	);
	if (exists) {
		const readBack = php.readFileAsText(settingsPath);
		console.log(
			'📝 [DRUPAL:writeSettingsPhp] Verification - readback length:',
			readBack.length
		);
		console.log(
			'📝 [DRUPAL:writeSettingsPhp] Verification - matches:',
			readBack === settingsContent
		);
	}

	console.log('📝 [DRUPAL:writeSettingsPhp] ========== END ==========');
}

/**
 * Creates a services.yml file with development settings.
 */
export function generateServicesYml(): string {
	console.log('📝 [DRUPAL:generateServicesYml] Generating services.yml...');
	const content = `parameters:
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
	console.log(
		'📝 [DRUPAL:generateServicesYml] Generated content length:',
		content.length
	);
	return content;
}

/**
 * Writes the services.yml file for development settings.
 */
export async function writeServicesYml(
	php: PHP,
	documentRoot: string
): Promise<void> {
	console.log('📝 [DRUPAL:writeServicesYml] ========== START ==========');
	console.log('📝 [DRUPAL:writeServicesYml] documentRoot:', documentRoot);

	const servicesPath = joinPaths(documentRoot, 'sites/default/services.yml');
	console.log('📝 [DRUPAL:writeServicesYml] servicesPath:', servicesPath);

	const servicesContent = generateServicesYml();
	console.log('📝 [DRUPAL:writeServicesYml] Writing services.yml...');
	php.writeFile(servicesPath, servicesContent);
	console.log('📝 [DRUPAL:writeServicesYml] services.yml written');

	// Verify
	const exists = php.fileExists(servicesPath);
	console.log('📝 [DRUPAL:writeServicesYml] Verification - exists:', exists);

	console.log('📝 [DRUPAL:writeServicesYml] ========== END ==========');
}
