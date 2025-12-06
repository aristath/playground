import type {
	CookieStore,
	FileNotFoundAction,
	FileNotFoundGetActionCallback,
	FileTree,
	PHPProcessManager,
	SpawnHandler,
} from '@php-wasm/universal';
import {
	PHP,
	PHPRequestHandler,
	sandboxedSpawnHandlerFactory,
	setPhpIniEntries,
	withPHPIniValues,
	writeFiles,
} from '@php-wasm/universal';
import { unzipFile } from '@wp-playground/common';
import { joinPaths } from '@php-wasm/util';
import { logger } from '@php-wasm/logger';
import { drupalRewriteRules } from './rewrite-rules';
import { writeSettingsPhp, writeServicesYml } from './settings-php';

export type PhpIniOptions = Record<string, string>;
export type Hook = (php: PHP) => void | Promise<void>;

export interface Hooks {
	beforeDrupalFiles?: Hook;
	beforeDatabaseSetup?: Hook;
}

export type PHPInstanceCreatedHook = (
	php: PHP,
	{ isPrimary }: { isPrimary: boolean }
) => Promise<void>;

export async function bootDrupalAndRequestHandler(
	options: BootRequestHandlerOptions & BootDrupalOptions
) {
	const requestHandler = await bootRequestHandler(options);
	await bootDrupal(requestHandler, options);
	return requestHandler;
}

export interface BootRequestHandlerOptions {
	createPhpRuntime: (isPrimary?: boolean) => Promise<number>;
	onPHPInstanceCreated?: PHPInstanceCreatedHook;
	/**
	 * PHP SAPI name to be returned by get_sapi_name(). Overriding
	 * it is useful for running programs that check for this value,
	 * e.g. Drush
	 */
	sapiName?: string;
	/**
	 * URL to use as the site URL.
	 */
	siteUrl: string;
	documentRoot?: string;
	spawnHandler?: (processManager: PHPProcessManager) => SpawnHandler;
	/**
	 * PHP.ini entries to define before running any code. They'll
	 * be used for all requests.
	 */
	phpIniEntries?: PhpIniOptions;
	/**
	 * Files to create in the filesystem before any mounts are applied.
	 */
	createFiles?: FileTree;
	/**
	 * A callback that decides how to handle a file-not-found condition for a
	 * given request URI.
	 */
	getFileNotFoundAction?: FileNotFoundGetActionCallback;
	/**
	 * The CookieStore instance to use.
	 */
	cookieStore?: CookieStore | false;
}

export type DrupalInstallMode =
	| 'download-and-install'
	| 'install-from-existing-files'
	| 'install-from-existing-files-if-needed'
	| 'do-not-attempt-installing';

export interface BootDrupalOptions {
	/**
	 * Hooks to customize the boot process.
	 */
	hooks?: Hooks;
	/** How to handle Drupal installation. */
	drupalInstallMode?: DrupalInstallMode;
	/** Zip with the Drupal installation to extract in /drupal. */
	drupalZip?: File | Promise<File> | undefined;
	/**
	 * URL to use as the site URL.
	 */
	siteUrl: string;
	/**
	 * The Drupal installation profile to use.
	 * @default 'standard'
	 */
	installProfile?: string;
	/**
	 * Admin username for the Drupal site.
	 * @default 'admin'
	 */
	adminUsername?: string;
	/**
	 * Admin password for the Drupal site.
	 * @default 'password'
	 */
	adminPassword?: string;
	/**
	 * Site name for the Drupal site.
	 * @default 'My Drupal Website'
	 */
	siteName?: string;
}

/**
 * Boots a Drupal instance with the given options.
 *
 * High-level overview:
 *
 * * Boot PHP instances and PHPRequestHandler
 * * Setup VFS, run beforeDrupalFiles hook
 * * Setup Drupal files (if drupalZip is provided)
 * * Run beforeDatabaseSetup hook
 * * Setup the database (SQLite)
 * * Run Drupal installer, if the site isn't installed yet
 *
 * @param options Boot configuration options
 * @return PHPRequestHandler instance with Drupal installed.
 */
export async function bootDrupal(
	requestHandler: PHPRequestHandler,
	options: BootDrupalOptions
) {
	const php = await requestHandler.getPrimaryPhp();

	if (options.hooks?.beforeDrupalFiles) {
		await options.hooks.beforeDrupalFiles(php);
	}

	if (options.drupalZip) {
		await unzipDrupal(php, await options.drupalZip);
	}

	// Run "before database" hooks to mount/copy more files in
	if (options.hooks?.beforeDatabaseSetup) {
		await options.hooks.beforeDatabaseSetup(php);
	}

	// Setup settings.php for SQLite
	await writeSettingsPhp(php, requestHandler.documentRoot, {
		siteUrl: options.siteUrl,
	});

	// Setup services.yml for development
	await writeServicesYml(php, requestHandler.documentRoot);

	const installationMode =
		options.drupalInstallMode ?? 'download-and-install';

	if (
		['download-and-install', 'install-from-existing-files'].includes(
			installationMode
		)
	) {
		// Install Drupal if it's not installed.
		if (!(await isDrupalInstalled(php))) {
			await installDrupal(php, options);
		}
	} else if ('install-from-existing-files-if-needed' === installationMode) {
		if (!(await isDrupalInstalled(php))) {
			await installDrupal(php, options);
		}
	}

	return requestHandler;
}

export async function bootRequestHandler(options: BootRequestHandlerOptions) {
	const spawnHandler = options.spawnHandler ?? sandboxedSpawnHandlerFactory;

	async function createPhp(
		requestHandler: PHPRequestHandler,
		isPrimary: boolean
	) {
		const runtimeId = await options.createPhpRuntime(isPrimary);
		const php = new PHP(runtimeId);

		if (options.sapiName) {
			php.setSapiName(options.sapiName);
		}

		if (requestHandler) {
			php.requestHandler = requestHandler;
		}

		if (options.phpIniEntries) {
			setPhpIniEntries(php, options.phpIniEntries);
		}

		/**
		 * Set up platform-level customization for Drupal.
		 * We only do this in the primary PHP instance.
		 */
		if (isPrimary && !php.isFile('/internal/.boot-files-written')) {
			await writeFiles(php, '/', options.createFiles || {});
			await writeFiles(php, '/internal', {
				'.boot-files-written': '',
			});
		}

		// Spawn handler for popen(), proc_open() etc.
		if (spawnHandler) {
			await php.setSpawnHandler(
				spawnHandler(requestHandler.processManager)
			);
		}

		// Rotate PHP runtime periodically to avoid memory leak-related crashes.
		php.enableRuntimeRotation({
			recreateRuntime: options.createPhpRuntime,
			maxRequests: 400,
		});

		if (options.onPHPInstanceCreated) {
			await options.onPHPInstanceCreated(php, { isPrimary });
		}

		return php;
	}

	const requestHandler: PHPRequestHandler = new PHPRequestHandler({
		phpFactory: async ({ isPrimary }) =>
			createPhp(requestHandler, isPrimary),
		documentRoot: options.documentRoot || '/drupal',
		absoluteUrl: options.siteUrl,
		rewriteRules: drupalRewriteRules,
		getFileNotFoundAction:
			options.getFileNotFoundAction ?? getFileNotFoundActionForDrupal,
		cookieStore: options.cookieStore,
	});

	return requestHandler;
}

/**
 * Checks if Drupal is installed by checking if the database exists
 * and if the system module is installed.
 */
export async function isDrupalInstalled(php: PHP): Promise<boolean> {
	const result = await php.run({
		code: `<?php
			$settings_file = getenv('DOCUMENT_ROOT') . '/sites/default/settings.php';
			if (!file_exists($settings_file)) {
				echo '0';
				exit;
			}

			// Check if the SQLite database file exists
			$db_file = getenv('DOCUMENT_ROOT') . '/sites/default/files/.ht.sqlite';
			if (!file_exists($db_file)) {
				echo '0';
				exit;
			}

			// Try to load Drupal and check if it's installed
			try {
				chdir(getenv('DOCUMENT_ROOT'));
				$autoloader = require_once getenv('DOCUMENT_ROOT') . '/autoload.php';
				$kernel = new \\Drupal\\Core\\DrupalKernel('prod', $autoloader);
				$kernel->setSitePath('sites/default');

				// Try to boot - if this succeeds, Drupal is installed
				$request = \\Symfony\\Component\\HttpFoundation\\Request::createFromGlobals();
				$kernel->boot();
				$container = $kernel->getContainer();
				$db = $container->get('database');

				// Check if the system module is installed (core installation marker)
				$result = $db->select('key_value', 'kv')
					->fields('kv', ['value'])
					->condition('collection', 'system.schema')
					->condition('name', 'system')
					->execute()
					->fetchField();

				echo $result ? '1' : '0';
			} catch (\\Exception $e) {
				// If we can't boot, Drupal is not installed
				echo '0';
			}
		`,
		env: {
			DOCUMENT_ROOT: php.documentRoot,
		},
	});
	return result.text === '1';
}

/**
 * Runs the Drupal installation process.
 *
 * Drupal installation is done via the install.php script,
 * but we can also use Drush or direct database setup.
 */
async function installDrupal(
	php: PHP,
	options: BootDrupalOptions
): Promise<void> {
	const installProfile = options.installProfile ?? 'standard';
	const adminUsername = options.adminUsername ?? 'admin';
	const adminPassword = options.adminPassword ?? 'password';
	const siteName = options.siteName ?? 'My Drupal Website';

	logger.log('Installing Drupal...');

	// Use Drupal's batch installation API
	const response = await withPHPIniValues(
		php,
		{
			// Disable functions that could cause issues during install
			disable_functions: 'fsockopen',
			allow_url_fopen: '0',
			// Increase limits for installation
			max_execution_time: '300',
			memory_limit: '256M',
		},
		async () => {
			return await php.run({
				code: `<?php
					// Set error reporting
					error_reporting(E_ALL);
					ini_set('display_errors', '1');

					chdir(getenv('DOCUMENT_ROOT'));

					// Load Drupal's autoloader
					$autoloader = require_once getenv('DOCUMENT_ROOT') . '/autoload.php';

					// Define installation parameters
					$parameters = [
						'parameters' => [
							'profile' => '${installProfile}',
							'langcode' => 'en',
						],
						'forms' => [
							'install_settings_form' => [
								'driver' => 'sqlite',
								'sqlite' => [
									'database' => 'sites/default/files/.ht.sqlite',
								],
							],
							'install_configure_form' => [
								'site_name' => '${siteName}',
								'site_mail' => 'admin@localhost.com',
								'account' => [
									'name' => '${adminUsername}',
									'mail' => 'admin@localhost.com',
									'pass' => [
										'pass1' => '${adminPassword}',
										'pass2' => '${adminPassword}',
									],
								],
								'enable_update_status_module' => FALSE,
								'enable_update_status_emails' => FALSE,
							],
						],
					];

					// Try programmatic installation
					try {
						require_once getenv('DOCUMENT_ROOT') . '/core/includes/install.core.inc';
						install_drupal($autoloader, $parameters);
						echo 'SUCCESS';
					} catch (\\Exception $e) {
						echo 'ERROR: ' . $e->getMessage();
					}
				`,
				env: {
					DOCUMENT_ROOT: php.documentRoot,
				},
			});
		}
	);

	if (!response.text.includes('SUCCESS')) {
		// Log the error but try to continue - installation might have partially succeeded
		logger.warn(
			`Drupal installation may have encountered issues: ${response.text}`
		);

		// Fallback: Try the web-based installer
		await installDrupalViaWeb(php, options);
	}

	if (!(await isDrupalInstalled(php))) {
		throw new Error('Failed to install Drupal');
	}

	logger.log('Drupal installation complete');
}

/**
 * Fallback installation via the web installer.
 */
async function installDrupalViaWeb(
	php: PHP,
	options: BootDrupalOptions
): Promise<void> {
	const installProfile = options.installProfile ?? 'standard';
	const adminUsername = options.adminUsername ?? 'admin';
	const adminPassword = options.adminPassword ?? 'password';
	const siteName = options.siteName ?? 'My Drupal Website';

	// Step 1: Select profile
	await php.request({
		url: '/core/install.php',
		method: 'GET',
	});

	// Step 2: Submit profile selection
	await php.request({
		url: '/core/install.php',
		method: 'POST',
		body: {
			profile: installProfile,
			langcode: 'en',
			op: 'Save and continue',
		},
	});

	// Step 3: Database configuration
	await php.request({
		url: '/core/install.php',
		method: 'POST',
		body: {
			driver: 'sqlite',
			'sqlite[database]': 'sites/default/files/.ht.sqlite',
			op: 'Save and continue',
		},
	});

	// Step 4: Site configuration
	await php.request({
		url: '/core/install.php',
		method: 'POST',
		body: {
			site_name: siteName,
			site_mail: 'admin@localhost.com',
			'account[name]': adminUsername,
			'account[mail]': 'admin@localhost.com',
			'account[pass][pass1]': adminPassword,
			'account[pass][pass2]': adminPassword,
			enable_update_status_module: '0',
			enable_update_status_emails: '0',
			op: 'Save and continue',
		},
	});
}

/**
 * Extracts Drupal from a zip file into the document root.
 */
export async function unzipDrupal(php: PHP, drupalZip: File): Promise<void> {
	// Unzip to a temporary directory first
	const tempDir = '/tmp/drupal-extract';
	if (php.isDir(tempDir)) {
		php.rmdir(tempDir, { recursive: true });
	}
	php.mkdir(tempDir);

	await unzipFile(php, drupalZip, tempDir);

	// Find the Drupal root directory (might be inside a subdirectory like 'drupal-9.5.11')
	const extractedDirs = php.listFiles(tempDir);
	let drupalSourceDir = tempDir;

	// Check if there's a single directory containing Drupal
	if (extractedDirs.length === 1) {
		const possibleDir = joinPaths(tempDir, extractedDirs[0]);
		if (
			php.isDir(possibleDir) &&
			php.isFile(joinPaths(possibleDir, 'index.php'))
		) {
			drupalSourceDir = possibleDir;
		}
	}

	// Move files to the document root
	const docRoot = php.documentRoot;
	if (!php.isDir(docRoot)) {
		php.mkdir(docRoot);
	}

	// Use PHP to copy files (handles large directories better)
	await php.run({
		code: `<?php
			$source = '${drupalSourceDir}';
			$dest = '${docRoot}';

			function recursiveCopy($src, $dst) {
				$dir = opendir($src);
				@mkdir($dst);
				while (($file = readdir($dir)) !== false) {
					if ($file === '.' || $file === '..') continue;
					$srcPath = $src . '/' . $file;
					$dstPath = $dst . '/' . $file;
					if (is_dir($srcPath)) {
						recursiveCopy($srcPath, $dstPath);
					} else {
						copy($srcPath, $dstPath);
					}
				}
				closedir($dir);
			}

			recursiveCopy($source, $dest);
			echo 'DONE';
		`,
	});

	// Cleanup
	php.rmdir(tempDir, { recursive: true });
}

export function getFileNotFoundActionForDrupal(
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	relativeUri: string
): FileNotFoundAction {
	// Delegate unresolved requests to Drupal's index.php
	// This enables clean URLs and routing through Drupal's menu system
	return {
		type: 'internal-redirect',
		uri: '/index.php',
	};
}
