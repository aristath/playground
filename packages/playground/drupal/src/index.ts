/**
 * @wp-playground/drupal
 *
 * Drupal-related plumbing for WordPress Playground.
 * Provides the boot process, rewrite rules, and settings configuration
 * for running Drupal 9+ in the browser using PHP-WASM.
 */

// Boot functions
export {
	bootDrupal,
	bootDrupalAndRequestHandler,
	bootRequestHandler,
	isDrupalInstalled,
	unzipDrupal,
	getFileNotFoundActionForDrupal,
} from './boot';

// Types
export type {
	BootRequestHandlerOptions,
	BootDrupalOptions,
	DrupalInstallMode,
	Hooks,
	Hook,
	PHPInstanceCreatedHook,
	PhpIniOptions,
} from './boot';

// Rewrite rules
export { drupalRewriteRules } from './rewrite-rules';

// Settings PHP
export {
	generateSettingsPhp,
	writeSettingsPhp,
	generateServicesYml,
	writeServicesYml,
} from './settings-php';

export type { DrupalSettingsOptions } from './settings-php';
