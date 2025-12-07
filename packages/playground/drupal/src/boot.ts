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
	console.log(
		'🚀 [DRUPAL:bootDrupalAndRequestHandler] ========== START =========='
	);
	console.log(
		'🚀 [DRUPAL:bootDrupalAndRequestHandler] options keys:',
		Object.keys(options)
	);
	const requestHandler = await bootRequestHandler(options);
	console.log(
		'🚀 [DRUPAL:bootDrupalAndRequestHandler] requestHandler created, documentRoot:',
		requestHandler.documentRoot
	);
	await bootDrupal(requestHandler, options);
	console.log('🚀 [DRUPAL:bootDrupalAndRequestHandler] bootDrupal complete');
	console.log(
		'🚀 [DRUPAL:bootDrupalAndRequestHandler] ========== END =========='
	);
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
	console.log('🚀 [DRUPAL:bootDrupal] ========== START ==========');
	console.log(
		'🚀 [DRUPAL:bootDrupal] requestHandler.documentRoot:',
		requestHandler.documentRoot
	);
	console.log(
		'🚀 [DRUPAL:bootDrupal] requestHandler.absoluteUrl:',
		requestHandler.absoluteUrl
	);
	console.log(
		'🚀 [DRUPAL:bootDrupal] options:',
		JSON.stringify(
			{
				siteUrl: options.siteUrl,
				installProfile: options.installProfile,
				adminUsername: options.adminUsername,
				siteName: options.siteName,
				drupalInstallMode: options.drupalInstallMode,
				hasDrupalZip: !!options.drupalZip,
				hasBeforeDrupalFilesHook: !!options.hooks?.beforeDrupalFiles,
				hasBeforeDatabaseSetupHook:
					!!options.hooks?.beforeDatabaseSetup,
			},
			null,
			2
		)
	);

	console.log('🚀 [DRUPAL:bootDrupal] Getting primary PHP...');
	const php = await requestHandler.getPrimaryPhp();
	console.log('🚀 [DRUPAL:bootDrupal] Primary PHP obtained');
	console.log('🚀 [DRUPAL:bootDrupal] php.documentRoot:', php.documentRoot);
	console.log(
		'🚀 [DRUPAL:bootDrupal] php constructor:',
		php.constructor.name
	);

	if (options.hooks?.beforeDrupalFiles) {
		console.log('🚀 [DRUPAL:bootDrupal] Running beforeDrupalFiles hook...');
		await options.hooks.beforeDrupalFiles(php);
		console.log('🚀 [DRUPAL:bootDrupal] beforeDrupalFiles hook complete');
	}

	if (options.drupalZip) {
		console.log('🚀 [DRUPAL:bootDrupal] Unzipping Drupal...');
		const drupalZipFile = await options.drupalZip;
		console.log('🚀 [DRUPAL:bootDrupal] drupalZip resolved:', {
			name: drupalZipFile.name,
			size: drupalZipFile.size,
			type: drupalZipFile.type,
		});
		await unzipDrupal(php, drupalZipFile);
		console.log('🚀 [DRUPAL:bootDrupal] Drupal unzipped');

		// List files after unzip
		const listResult = await php.run({
			code: `<?php
				$d = getenv('DOCUMENT_ROOT');
				$files = [];
				if (is_dir($d)) {
					$files = array_slice(scandir($d), 0, 30);
				}
				echo json_encode([
					'docroot' => $d,
					'exists' => is_dir($d),
					'file_count' => count($files),
					'files' => $files,
					'core_exists' => is_dir($d . '/core'),
					'sites_exists' => is_dir($d . '/sites'),
					'index_exists' => file_exists($d . '/index.php'),
					'autoload_exists' => file_exists($d . '/autoload.php'),
				], JSON_PRETTY_PRINT);
			`,
			env: { DOCUMENT_ROOT: php.documentRoot },
		});
		console.log(
			'🚀 [DRUPAL:bootDrupal] Files after unzip:',
			listResult.text
		);
	}

	// Run "before database" hooks to mount/copy more files in
	if (options.hooks?.beforeDatabaseSetup) {
		console.log(
			'🚀 [DRUPAL:bootDrupal] Running beforeDatabaseSetup hook...'
		);
		await options.hooks.beforeDatabaseSetup(php);
		console.log('🚀 [DRUPAL:bootDrupal] beforeDatabaseSetup hook complete');
	}

	// Setup settings.php for SQLite
	console.log('🚀 [DRUPAL:bootDrupal] Writing settings.php...');
	console.log('🚀 [DRUPAL:bootDrupal] writeSettingsPhp params:', {
		phpDocumentRoot: php.documentRoot,
		requestHandlerDocumentRoot: requestHandler.documentRoot,
		siteUrl: options.siteUrl,
	});
	await writeSettingsPhp(php, requestHandler.documentRoot, {
		siteUrl: options.siteUrl,
	});
	console.log('🚀 [DRUPAL:bootDrupal] settings.php written');

	// Verify settings.php was written
	const settingsCheck = await php.run({
		code: `<?php
			$d = getenv('DOCUMENT_ROOT');
			$s = "$d/sites/default/settings.php";
			echo json_encode([
				'path' => $s,
				'exists' => file_exists($s),
				'readable' => is_readable($s),
				'size' => file_exists($s) ? filesize($s) : 0,
				'first_200_chars' => file_exists($s) ? substr(file_get_contents($s), 0, 200) : '',
			], JSON_PRETTY_PRINT);
		`,
		env: { DOCUMENT_ROOT: requestHandler.documentRoot },
	});
	console.log(
		'🚀 [DRUPAL:bootDrupal] settings.php verification:',
		settingsCheck.text
	);

	// Setup services.yml for development
	console.log('🚀 [DRUPAL:bootDrupal] Writing services.yml...');
	await writeServicesYml(php, requestHandler.documentRoot);
	console.log('🚀 [DRUPAL:bootDrupal] services.yml written');

	const installationMode =
		options.drupalInstallMode ?? 'download-and-install';
	console.log('🚀 [DRUPAL:bootDrupal] installationMode:', installationMode);

	// Check installation status BEFORE attempting install
	console.log(
		'🚀 [DRUPAL:bootDrupal] Checking if already installed (pre-install check)...'
	);
	const alreadyInstalled = await isDrupalInstalled(php);
	console.log('🚀 [DRUPAL:bootDrupal] Already installed:', alreadyInstalled);

	if (
		['download-and-install', 'install-from-existing-files'].includes(
			installationMode
		)
	) {
		// Install Drupal if it's not installed.
		if (!alreadyInstalled) {
			console.log(
				'🚀 [DRUPAL:bootDrupal] Starting Drupal installation...'
			);
			await installDrupal(php, options);
			console.log('🚀 [DRUPAL:bootDrupal] installDrupal() returned');
		} else {
			console.log(
				'🚀 [DRUPAL:bootDrupal] Skipping installation - already installed'
			);
		}
	} else if ('install-from-existing-files-if-needed' === installationMode) {
		if (!alreadyInstalled) {
			console.log(
				'🚀 [DRUPAL:bootDrupal] Starting Drupal installation (from existing files if needed)...'
			);
			await installDrupal(php, options);
			console.log('🚀 [DRUPAL:bootDrupal] installDrupal() returned');
		}
	}

	// Final verification
	console.log('🚀 [DRUPAL:bootDrupal] Final installation check...');
	const finalCheck = await isDrupalInstalled(php);
	console.log('🚀 [DRUPAL:bootDrupal] Final check result:', finalCheck);

	console.log('🚀 [DRUPAL:bootDrupal] ========== END ==========');
	return requestHandler;
}

export async function bootRequestHandler(options: BootRequestHandlerOptions) {
	console.log('⚙️ [DRUPAL:bootRequestHandler] ========== START ==========');
	console.log(
		'⚙️ [DRUPAL:bootRequestHandler] options:',
		JSON.stringify(
			{
				siteUrl: options.siteUrl,
				documentRoot: options.documentRoot,
				sapiName: options.sapiName,
				hasCreatePhpRuntime: !!options.createPhpRuntime,
				hasOnPHPInstanceCreated: !!options.onPHPInstanceCreated,
				hasSpawnHandler: !!options.spawnHandler,
				hasPhpIniEntries: !!options.phpIniEntries,
				phpIniEntryKeys: options.phpIniEntries
					? Object.keys(options.phpIniEntries)
					: [],
				hasCreateFiles: !!options.createFiles,
				createFilesKeys: options.createFiles
					? Object.keys(options.createFiles)
					: [],
				hasGetFileNotFoundAction: !!options.getFileNotFoundAction,
				hasCookieStore: options.cookieStore !== undefined,
			},
			null,
			2
		)
	);

	const spawnHandler = options.spawnHandler ?? sandboxedSpawnHandlerFactory;
	console.log(
		'⚙️ [DRUPAL:bootRequestHandler] spawnHandler:',
		options.spawnHandler
			? 'custom'
			: 'default (sandboxedSpawnHandlerFactory)'
	);

	async function createPhp(
		requestHandler: PHPRequestHandler,
		isPrimary: boolean
	) {
		console.log(
			'⚙️ [DRUPAL:bootRequestHandler:createPhp] Creating PHP instance, isPrimary:',
			isPrimary
		);
		const runtimeId = await options.createPhpRuntime(isPrimary);
		console.log(
			'⚙️ [DRUPAL:bootRequestHandler:createPhp] runtimeId:',
			runtimeId
		);
		const php = new PHP(runtimeId);
		console.log(
			'⚙️ [DRUPAL:bootRequestHandler:createPhp] PHP instance created'
		);

		if (options.sapiName) {
			console.log(
				'⚙️ [DRUPAL:bootRequestHandler:createPhp] Setting SAPI name:',
				options.sapiName
			);
			php.setSapiName(options.sapiName);
		}

		if (requestHandler) {
			console.log(
				'⚙️ [DRUPAL:bootRequestHandler:createPhp] Setting requestHandler on php'
			);
			php.requestHandler = requestHandler;
		}

		if (options.phpIniEntries) {
			console.log(
				'⚙️ [DRUPAL:bootRequestHandler:createPhp] Setting PHP INI entries:',
				Object.keys(options.phpIniEntries)
			);
			setPhpIniEntries(php, options.phpIniEntries);
		}

		/**
		 * Set up platform-level customization for Drupal.
		 * We only do this in the primary PHP instance.
		 */
		if (isPrimary && !php.isFile('/internal/.boot-files-written')) {
			console.log(
				'⚙️ [DRUPAL:bootRequestHandler:createPhp] Writing boot files...'
			);
			await writeFiles(php, '/', options.createFiles || {});
			await writeFiles(php, '/internal', {
				'.boot-files-written': '',
			});
			console.log(
				'⚙️ [DRUPAL:bootRequestHandler:createPhp] Boot files written'
			);
		}

		// Spawn handler for popen(), proc_open() etc.
		if (spawnHandler) {
			console.log(
				'⚙️ [DRUPAL:bootRequestHandler:createPhp] Setting spawn handler'
			);
			await php.setSpawnHandler(
				spawnHandler(requestHandler.processManager)
			);
		}

		// Rotate PHP runtime periodically to avoid memory leak-related crashes.
		console.log(
			'⚙️ [DRUPAL:bootRequestHandler:createPhp] Enabling runtime rotation'
		);
		php.enableRuntimeRotation({
			recreateRuntime: options.createPhpRuntime,
			maxRequests: 400,
		});

		if (options.onPHPInstanceCreated) {
			console.log(
				'⚙️ [DRUPAL:bootRequestHandler:createPhp] Calling onPHPInstanceCreated hook'
			);
			await options.onPHPInstanceCreated(php, { isPrimary });
			console.log(
				'⚙️ [DRUPAL:bootRequestHandler:createPhp] onPHPInstanceCreated hook complete'
			);
		}

		console.log(
			'⚙️ [DRUPAL:bootRequestHandler:createPhp] PHP instance ready, documentRoot:',
			php.documentRoot
		);
		return php;
	}

	const resolvedDocumentRoot = options.documentRoot || '/drupal';
	console.log(
		'⚙️ [DRUPAL:bootRequestHandler] Creating PHPRequestHandler with documentRoot:',
		resolvedDocumentRoot
	);

	const requestHandler: PHPRequestHandler = new PHPRequestHandler({
		phpFactory: async ({ isPrimary }) =>
			createPhp(requestHandler, isPrimary),
		documentRoot: resolvedDocumentRoot,
		absoluteUrl: options.siteUrl,
		rewriteRules: drupalRewriteRules,
		getFileNotFoundAction:
			options.getFileNotFoundAction ?? getFileNotFoundActionForDrupal,
		cookieStore: options.cookieStore,
	});

	console.log('⚙️ [DRUPAL:bootRequestHandler] PHPRequestHandler created');
	console.log(
		'⚙️ [DRUPAL:bootRequestHandler] requestHandler.documentRoot:',
		requestHandler.documentRoot
	);
	console.log(
		'⚙️ [DRUPAL:bootRequestHandler] requestHandler.absoluteUrl:',
		requestHandler.absoluteUrl
	);
	console.log('⚙️ [DRUPAL:bootRequestHandler] ========== END ==========');

	return requestHandler;
}

/**
 * Checks if Drupal is installed by checking if the database exists
 * and if the system module is installed.
 */
export async function isDrupalInstalled(php: PHP): Promise<boolean> {
	console.log(
		'🔍 [DRUPAL:isDrupalInstalled] ========== CHECK START =========='
	);
	console.log(
		'🔍 [DRUPAL:isDrupalInstalled] php.documentRoot:',
		php.documentRoot
	);
	console.log(
		'🔍 [DRUPAL:isDrupalInstalled] php constructor:',
		php.constructor.name
	);

	const result = await php.run({
		code: `<?php
			error_reporting(E_ALL);
			ini_set('display_errors', '1');
			ini_set('log_errors', '1');

			$debug = [
				'timestamp' => date('Y-m-d H:i:s'),
				'php_version' => PHP_VERSION,
				'memory_limit' => ini_get('memory_limit'),
				'cwd' => getcwd(),
			];

			$docroot = getenv('DOCUMENT_ROOT');
			$debug['env_docroot'] = $docroot;

			// Step 1: Basic file checks
			$debug['step'] = '1_file_checks';
			$debug['docroot_exists'] = is_dir($docroot);
			$debug['docroot_readable'] = is_readable($docroot);

			if ($debug['docroot_exists']) {
				$debug['docroot_contents'] = array_slice(scandir($docroot), 0, 30);
			}

			$settings_file = $docroot . '/sites/default/settings.php';
			$debug['settings_path'] = $settings_file;
			$debug['settings_exists'] = file_exists($settings_file);
			$debug['settings_readable'] = is_readable($settings_file);
			if ($debug['settings_exists']) {
				$debug['settings_size'] = filesize($settings_file);
				$debug['settings_first_100_chars'] = substr(file_get_contents($settings_file), 0, 100);
			}

			if (!$debug['settings_exists']) {
				$debug['result'] = 'FAIL_NO_SETTINGS';
				$debug['is_installed'] = false;
				echo json_encode($debug, JSON_PRETTY_PRINT);
				exit;
			}

			// Step 2: Database file check
			$debug['step'] = '2_database_check';
			$db_file = $docroot . '/sites/default/files/.ht.sqlite';
			$debug['db_path'] = $db_file;
			$debug['db_exists'] = file_exists($db_file);
			if ($debug['db_exists']) {
				$debug['db_size'] = filesize($db_file);
				$debug['db_readable'] = is_readable($db_file);
				$debug['db_writable'] = is_writable($db_file);
			}

			// Also check files directory
			$files_dir = $docroot . '/sites/default/files';
			$debug['files_dir_exists'] = is_dir($files_dir);
			if ($debug['files_dir_exists']) {
				$debug['files_dir_contents'] = array_slice(scandir($files_dir), 0, 20);
			}

			if (!$debug['db_exists']) {
				$debug['result'] = 'FAIL_NO_DATABASE';
				$debug['is_installed'] = false;
				echo json_encode($debug, JSON_PRETTY_PRINT);
				exit;
			}

			// Step 3: Try to load autoloader
			$debug['step'] = '3_autoloader';
			try {
				chdir($docroot);
				$debug['chdir_success'] = true;
				$debug['new_cwd'] = getcwd();

				$autoload_path = $docroot . '/autoload.php';
				$debug['autoload_path'] = $autoload_path;
				$debug['autoload_exists'] = file_exists($autoload_path);

				if (!$debug['autoload_exists']) {
					$debug['result'] = 'FAIL_NO_AUTOLOAD';
					$debug['is_installed'] = false;
					echo json_encode($debug, JSON_PRETTY_PRINT);
					exit;
				}

				$autoloader = require_once $autoload_path;
				$debug['autoloader_loaded'] = true;
				$debug['autoloader_type'] = gettype($autoloader);
				$debug['autoloader_class'] = is_object($autoloader) ? get_class($autoloader) : 'not_object';

			} catch (\\Throwable $e) {
				$debug['autoloader_error'] = $e->getMessage();
				$debug['autoloader_file'] = $e->getFile();
				$debug['autoloader_line'] = $e->getLine();
				$debug['result'] = 'FAIL_AUTOLOADER_ERROR';
				$debug['is_installed'] = false;
				echo json_encode($debug, JSON_PRETTY_PRINT);
				exit;
			}

			// Step 4: Create request first (needed for createFromRequest)
			$debug['step'] = '4_request_create';
			try {
				$debug['symfony_request_exists'] = class_exists('\\Symfony\\Component\\HttpFoundation\\Request');

				$request = \\Symfony\\Component\\HttpFoundation\\Request::createFromGlobals();
				$debug['request_created'] = true;
				$debug['request_uri'] = $request->getRequestUri();

			} catch (\\Throwable $e) {
				$debug['request_error'] = $e->getMessage();
				$debug['result'] = 'FAIL_REQUEST_CREATE';
				$debug['is_installed'] = false;
				echo json_encode($debug, JSON_PRETTY_PRINT);
				exit;
			}

			// Step 5: Create kernel using createFromRequest (loads settings.php and registers DB)
			$debug['step'] = '5_kernel_create';
			try {
				$debug['drupal_kernel_class_exists'] = class_exists('\\Drupal\\Core\\DrupalKernel');

				// Use createFromRequest which calls initializeSettings() -> Settings::initialize()
				// This loads settings.php and registers $databases via Database::setMultipleConnectionInfo()
				$kernel = \\Drupal\\Core\\DrupalKernel::createFromRequest($request, $autoloader, 'prod');
				$debug['kernel_created'] = true;
				$debug['site_path'] = $kernel->getSitePath();

			} catch (\\Throwable $e) {
				$debug['kernel_error'] = $e->getMessage();
				$debug['kernel_file'] = $e->getFile();
				$debug['kernel_line'] = $e->getLine();
				$debug['kernel_trace'] = array_map(function($t) {
					return ($t['file'] ?? 'unknown') . ':' . ($t['line'] ?? 0) . ' ' . ($t['function'] ?? '');
				}, array_slice($e->getTrace(), 0, 10));
				$debug['result'] = 'FAIL_KERNEL_CREATE';
				$debug['is_installed'] = false;
				echo json_encode($debug, JSON_PRETTY_PRINT);
				exit;
			}

			// Step 6: Boot kernel (should work now that DB is registered)
			$debug['step'] = '6_kernel_boot';
			try {
				$kernel->boot();
				$debug['kernel_booted'] = true;

			} catch (\\Throwable $e) {
				$debug['boot_error'] = $e->getMessage();
				$debug['boot_file'] = $e->getFile();
				$debug['boot_line'] = $e->getLine();
				$debug['boot_trace'] = array_map(function($t) {
					return ($t['file'] ?? 'unknown') . ':' . ($t['line'] ?? 0) . ' ' . ($t['function'] ?? '');
				}, array_slice($e->getTrace(), 0, 15));
				$debug['result'] = 'FAIL_KERNEL_BOOT';
				$debug['is_installed'] = false;
				echo json_encode($debug, JSON_PRETTY_PRINT);
				exit;
			}

			// Step 7: Get container
			$debug['step'] = '7_container';
			try {
				$container = $kernel->getContainer();
				$debug['container_obtained'] = true;
				$debug['container_class'] = get_class($container);

			} catch (\\Throwable $e) {
				$debug['container_error'] = $e->getMessage();
				$debug['result'] = 'FAIL_CONTAINER';
				$debug['is_installed'] = false;
				echo json_encode($debug, JSON_PRETTY_PRINT);
				exit;
			}

			// Step 8: Get database
			$debug['step'] = '8_database_service';
			try {
				$debug['has_database_service'] = $container->has('database');

				$db = $container->get('database');
				$debug['database_obtained'] = true;
				$debug['database_class'] = get_class($db);
				$debug['database_driver'] = $db->driver();

			} catch (\\Throwable $e) {
				$debug['database_service_error'] = $e->getMessage();
				$debug['database_service_trace'] = array_map(function($t) {
					return ($t['file'] ?? 'unknown') . ':' . ($t['line'] ?? 0) . ' ' . ($t['function'] ?? '');
				}, array_slice($e->getTrace(), 0, 10));
				$debug['result'] = 'FAIL_DATABASE_SERVICE';
				$debug['is_installed'] = false;
				echo json_encode($debug, JSON_PRETTY_PRINT);
				exit;
			}

			// Step 9: Query key_value table
			$debug['step'] = '9_query_key_value';
			try {
				// First check if table exists
				$tables = $db->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAllKeyed(0, 0);
				$debug['all_tables'] = array_keys($tables);
				$debug['key_value_exists'] = isset($tables['key_value']);

				if (!isset($tables['key_value'])) {
					$debug['result'] = 'FAIL_NO_KEY_VALUE_TABLE';
					$debug['is_installed'] = false;
					echo json_encode($debug, JSON_PRETTY_PRINT);
					exit;
				}

				// Query for system module
				$result = $db->select('key_value', 'kv')
					->fields('kv', ['collection', 'name', 'value'])
					->condition('collection', 'system.schema')
					->condition('name', 'system')
					->execute()
					->fetchAssoc();

				$debug['query_result'] = $result;
				$debug['system_found'] = !empty($result);

				// Also get all system.schema entries for debugging
				$all_schema = $db->select('key_value', 'kv')
					->fields('kv', ['collection', 'name'])
					->condition('collection', 'system.schema')
					->execute()
					->fetchAll();
				$debug['all_system_schema'] = array_map(function($r) { return $r->name; }, $all_schema);

			} catch (\\Throwable $e) {
				$debug['query_error'] = $e->getMessage();
				$debug['query_trace'] = array_map(function($t) {
					return ($t['file'] ?? 'unknown') . ':' . ($t['line'] ?? 0) . ' ' . ($t['function'] ?? '');
				}, array_slice($e->getTrace(), 0, 10));
				$debug['result'] = 'FAIL_QUERY';
				$debug['is_installed'] = false;
				echo json_encode($debug, JSON_PRETTY_PRINT);
				exit;
			}

			// Final result
			$debug['step'] = '10_final';
			$debug['is_installed'] = !empty($result);
			$debug['result'] = $debug['is_installed'] ? 'SUCCESS' : 'FAIL_SYSTEM_NOT_IN_KEY_VALUE';

			echo json_encode($debug, JSON_PRETTY_PRINT);
		`,
		env: {
			DOCUMENT_ROOT: php.documentRoot,
		},
	});

	console.log(
		'🔍 [DRUPAL:isDrupalInstalled] PHP stdout length:',
		result.text.length
	);
	console.log('🔍 [DRUPAL:isDrupalInstalled] PHP stdout:', result.text);
	console.log('🔍 [DRUPAL:isDrupalInstalled] PHP stderr:', result.errors);
	console.log('🔍 [DRUPAL:isDrupalInstalled] PHP exitCode:', result.exitCode);

	try {
		const data = JSON.parse(result.text);
		console.log(
			'🔍 [DRUPAL:isDrupalInstalled] Parsed data step:',
			data.step
		);
		console.log(
			'🔍 [DRUPAL:isDrupalInstalled] Parsed data result:',
			data.result
		);
		console.log(
			'🔍 [DRUPAL:isDrupalInstalled] Parsed data is_installed:',
			data.is_installed
		);
		console.log(
			'🔍 [DRUPAL:isDrupalInstalled] ========== CHECK END =========='
		);
		return data.is_installed === true;
	} catch (e) {
		console.log('🔍 [DRUPAL:isDrupalInstalled] JSON parse error:', e);
		console.log('🔍 [DRUPAL:isDrupalInstalled] Raw text was:', result.text);
		console.log(
			'🔍 [DRUPAL:isDrupalInstalled] ========== CHECK END (PARSE FAIL) =========='
		);
		return false;
	}
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
	console.log(
		'📦 [DRUPAL:installDrupal] ========== INSTALL START =========='
	);
	console.log(
		'📦 [DRUPAL:installDrupal] php.documentRoot:',
		php.documentRoot
	);
	console.log(
		'📦 [DRUPAL:installDrupal] options:',
		JSON.stringify({
			installProfile: options.installProfile,
			adminUsername: options.adminUsername,
			siteName: options.siteName,
			siteUrl: options.siteUrl,
		})
	);

	const installProfile = options.installProfile ?? 'standard';
	const adminUsername = options.adminUsername ?? 'admin';
	const adminPassword = options.adminPassword ?? 'password';
	const siteName = options.siteName ?? 'My Drupal Website';

	console.log('📦 [DRUPAL:installDrupal] Resolved values:', {
		installProfile,
		adminUsername,
		siteName,
	});

	logger.log('Installing Drupal...');

	// Pre-installation checks
	console.log('📦 [DRUPAL:installDrupal] Running pre-installation checks...');
	const preCheck = await php.run({
		code: `<?php
			$d = getenv('DOCUMENT_ROOT');
			echo json_encode([
				'docroot' => $d,
				'docroot_exists' => is_dir($d),
				'core_exists' => is_dir($d . '/core'),
				'install_core_inc' => file_exists($d . '/core/includes/install.core.inc'),
				'autoload' => file_exists($d . '/autoload.php'),
				'sites_default' => is_dir($d . '/sites/default'),
				'settings_php' => file_exists($d . '/sites/default/settings.php'),
				'files_dir' => is_dir($d . '/sites/default/files'),
				'files_writable' => is_writable($d . '/sites/default/files'),
				'memory_limit' => ini_get('memory_limit'),
				'max_execution_time' => ini_get('max_execution_time'),
			], JSON_PRETTY_PRINT);
		`,
		env: { DOCUMENT_ROOT: php.documentRoot },
	});
	console.log(
		'📦 [DRUPAL:installDrupal] Pre-installation checks:',
		preCheck.text
	);

	// Use Drupal's batch installation API
	console.log(
		'📦 [DRUPAL:installDrupal] Starting programmatic installation...'
	);
	const response = await withPHPIniValues(
		php,
		{
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

					echo "INSTALL_START\\n";
					echo "docroot: " . getenv('DOCUMENT_ROOT') . "\\n";

					chdir(getenv('DOCUMENT_ROOT'));
					echo "chdir done, cwd: " . getcwd() . "\\n";

					// Load Drupal's autoloader
					echo "Loading autoloader...\\n";
					$autoloader = require_once getenv('DOCUMENT_ROOT') . '/autoload.php';
					echo "Autoloader loaded, type: " . gettype($autoloader) . "\\n";

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

					echo "Parameters defined\\n";
					echo "Profile: ${installProfile}\\n";

					// Try programmatic installation
					try {
						echo "Loading install.core.inc...\\n";
						require_once getenv('DOCUMENT_ROOT') . '/core/includes/install.core.inc';
						echo "install.core.inc loaded\\n";

						echo "Calling install_drupal()...\\n";
						install_drupal($autoloader, $parameters);
						echo "\\nSUCCESS";
					} catch (\\Throwable $e) {
						echo "\\nERROR: " . $e->getMessage() . "\\n";
						echo "File: " . $e->getFile() . "\\n";
						echo "Line: " . $e->getLine() . "\\n";
						echo "Trace:\\n";
						foreach (array_slice($e->getTrace(), 0, 15) as $i => $t) {
							echo "  #$i " . ($t['file'] ?? 'unknown') . ':' . ($t['line'] ?? 0) . ' ' . ($t['function'] ?? '') . "\\n";
						}
					}
				`,
				env: {
					DOCUMENT_ROOT: php.documentRoot,
				},
			});
		}
	);

	// Log the PHP installation response for debugging
	console.log('📦 [DRUPAL:installDrupal] PHP response text:', response.text);
	console.log(
		'📦 [DRUPAL:installDrupal] PHP response errors:',
		response.errors
	);
	console.log(
		'📦 [DRUPAL:installDrupal] PHP response exitCode:',
		response.exitCode
	);
	logger.log('[Drupal Install] PHP response:', response.text);

	if (!response.text.includes('SUCCESS')) {
		// Log the error but try to continue - installation might have partially succeeded
		console.log(
			'📦 [DRUPAL:installDrupal] Installation did not report SUCCESS, trying web installer fallback...'
		);
		logger.warn(
			`Drupal installation may have encountered issues: ${response.text}`
		);

		// Fallback: Try the web-based installer
		await installDrupalViaWeb(php, options);
	} else {
		console.log('📦 [DRUPAL:installDrupal] Installation reported SUCCESS');
	}

	// Capture diagnostic state before checking installation
	console.log('📦 [DRUPAL:installDrupal] Post-installation diagnostics...');
	const diagResult = await php.run({
		code: `<?php
			$d = getenv('DOCUMENT_ROOT');
			echo json_encode([
				'docroot' => $d,
				'settings_exists' => file_exists("$d/sites/default/settings.php"),
				'db_exists' => file_exists("$d/sites/default/files/.ht.sqlite"),
				'db_size' => file_exists("$d/sites/default/files/.ht.sqlite") ? filesize("$d/sites/default/files/.ht.sqlite") : 0,
				'autoload' => file_exists("$d/autoload.php"),
				'core' => file_exists("$d/core/includes/install.core.inc"),
				'files_dir' => is_dir("$d/sites/default/files"),
				'files_contents' => is_dir("$d/sites/default/files") ? array_slice(scandir("$d/sites/default/files"), 0, 20) : [],
				'index_php' => file_exists("$d/index.php"),
			], JSON_PRETTY_PRINT);
		`,
		env: { DOCUMENT_ROOT: php.documentRoot },
	});
	console.log(
		'📦 [DRUPAL:installDrupal] Post-installation file state:',
		diagResult.text
	);
	logger.log('[Drupal Install Debug] File state:', diagResult.text);

	console.log(
		'📦 [DRUPAL:installDrupal] Checking if installation succeeded...'
	);
	if (!(await isDrupalInstalled(php))) {
		console.log(
			'📦 [DRUPAL:installDrupal] Installation verification FAILED'
		);
		throw new Error(
			`Failed to install Drupal. PHP output: ${response.text}. File state: ${diagResult.text}`
		);
	}

	console.log('📦 [DRUPAL:installDrupal] Installation verified successfully');
	logger.log('Drupal installation complete');
	console.log('📦 [DRUPAL:installDrupal] ========== INSTALL END ==========');
}

/**
 * Fallback installation via the web installer.
 */
async function installDrupalViaWeb(
	php: PHP,
	options: BootDrupalOptions
): Promise<void> {
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] ========== WEB INSTALL START =========='
	);
	const installProfile = options.installProfile ?? 'standard';
	const adminUsername = options.adminUsername ?? 'admin';
	const adminPassword = options.adminPassword ?? 'password';
	const siteName = options.siteName ?? 'My Drupal Website';

	console.log('🌐 [DRUPAL:installDrupalViaWeb] Parameters:', {
		installProfile,
		adminUsername,
		siteName,
	});

	// Step 1: Select profile
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] Step 1: GET /core/install.php'
	);
	const step1 = await php.request({
		url: '/core/install.php',
		method: 'GET',
	});
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] Step 1 status:',
		step1.httpStatusCode
	);
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] Step 1 text length:',
		step1.text.length
	);

	// Step 2: Submit profile selection
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] Step 2: POST profile selection'
	);
	const step2 = await php.request({
		url: '/core/install.php',
		method: 'POST',
		body: {
			profile: installProfile,
			langcode: 'en',
			op: 'Save and continue',
		},
	});
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] Step 2 status:',
		step2.httpStatusCode
	);
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] Step 2 text length:',
		step2.text.length
	);

	// Step 3: Database configuration
	console.log('🌐 [DRUPAL:installDrupalViaWeb] Step 3: POST database config');
	const step3 = await php.request({
		url: '/core/install.php',
		method: 'POST',
		body: {
			driver: 'sqlite',
			'sqlite[database]': 'sites/default/files/.ht.sqlite',
			op: 'Save and continue',
		},
	});
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] Step 3 status:',
		step3.httpStatusCode
	);
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] Step 3 text length:',
		step3.text.length
	);

	// Step 4: Site configuration
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] Step 4: POST site configuration'
	);
	const step4 = await php.request({
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
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] Step 4 status:',
		step4.httpStatusCode
	);
	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] Step 4 text length:',
		step4.text.length
	);

	console.log(
		'🌐 [DRUPAL:installDrupalViaWeb] ========== WEB INSTALL END =========='
	);
}

/**
 * Extracts Drupal from a zip file into the document root.
 */
export async function unzipDrupal(php: PHP, drupalZip: File): Promise<void> {
	console.log('📂 [DRUPAL:unzipDrupal] ========== START ==========');
	console.log('📂 [DRUPAL:unzipDrupal] php.documentRoot:', php.documentRoot);
	console.log('📂 [DRUPAL:unzipDrupal] drupalZip name:', drupalZip.name);
	console.log('📂 [DRUPAL:unzipDrupal] drupalZip size:', drupalZip.size);
	console.log('📂 [DRUPAL:unzipDrupal] drupalZip type:', drupalZip.type);

	// Unzip to a temporary directory first
	const tempDir = '/tmp/drupal-extract';
	console.log('📂 [DRUPAL:unzipDrupal] tempDir:', tempDir);

	if (php.isDir(tempDir)) {
		console.log('📂 [DRUPAL:unzipDrupal] Removing existing tempDir');
		php.rmdir(tempDir, { recursive: true });
	}
	php.mkdir(tempDir);
	console.log('📂 [DRUPAL:unzipDrupal] tempDir created');

	console.log('📂 [DRUPAL:unzipDrupal] Calling unzipFile...');
	await unzipFile(php, drupalZip, tempDir);
	console.log('📂 [DRUPAL:unzipDrupal] unzipFile complete');

	// Find the Drupal root directory (might be inside a subdirectory like 'drupal-9.5.11')
	const extractedDirs = php.listFiles(tempDir);
	console.log('📂 [DRUPAL:unzipDrupal] Extracted dirs:', extractedDirs);

	let drupalSourceDir = tempDir;

	// Check if there's a single directory containing Drupal
	if (extractedDirs.length === 1) {
		const possibleDir = joinPaths(tempDir, extractedDirs[0]);
		console.log(
			'📂 [DRUPAL:unzipDrupal] Checking possibleDir:',
			possibleDir
		);
		console.log('📂 [DRUPAL:unzipDrupal] isDir:', php.isDir(possibleDir));
		console.log(
			'📂 [DRUPAL:unzipDrupal] has index.php:',
			php.isFile(joinPaths(possibleDir, 'index.php'))
		);
		if (
			php.isDir(possibleDir) &&
			php.isFile(joinPaths(possibleDir, 'index.php'))
		) {
			drupalSourceDir = possibleDir;
			console.log(
				'📂 [DRUPAL:unzipDrupal] Using subdirectory as source:',
				drupalSourceDir
			);
		}
	}
	console.log(
		'📂 [DRUPAL:unzipDrupal] Final drupalSourceDir:',
		drupalSourceDir
	);

	// Move files to the document root
	const docRoot = php.documentRoot;
	console.log('📂 [DRUPAL:unzipDrupal] docRoot:', docRoot);

	if (!php.isDir(docRoot)) {
		console.log('📂 [DRUPAL:unzipDrupal] Creating docRoot directory');
		php.mkdir(docRoot);
	}

	// Use PHP to copy files (handles large directories better)
	console.log(
		'📂 [DRUPAL:unzipDrupal] Starting file copy from',
		drupalSourceDir,
		'to',
		docRoot
	);
	const copyResult = await php.run({
		code: `<?php
			$source = '${drupalSourceDir}';
			$dest = '${docRoot}';
			$count = 0;

			function recursiveCopy($src, $dst, &$count) {
				$dir = opendir($src);
				@mkdir($dst);
				while (($file = readdir($dir)) !== false) {
					if ($file === '.' || $file === '..') continue;
					$srcPath = $src . '/' . $file;
					$dstPath = $dst . '/' . $file;
					if (is_dir($srcPath)) {
						recursiveCopy($srcPath, $dstPath, $count);
					} else {
						copy($srcPath, $dstPath);
						$count++;
					}
				}
				closedir($dir);
			}

			recursiveCopy($source, $dest, $count);
			echo json_encode(['files_copied' => $count, 'source' => $source, 'dest' => $dest]);
		`,
	});
	console.log('📂 [DRUPAL:unzipDrupal] Copy result:', copyResult.text);

	// Verify the copy
	const verifyResult = await php.run({
		code: `<?php
			$d = '${docRoot}';
			echo json_encode([
				'exists' => is_dir($d),
				'files' => is_dir($d) ? array_slice(scandir($d), 0, 20) : [],
				'file_count' => is_dir($d) ? count(scandir($d)) - 2 : 0,
				'index_php' => file_exists($d . '/index.php'),
				'core' => is_dir($d . '/core'),
				'sites' => is_dir($d . '/sites'),
				'autoload' => file_exists($d . '/autoload.php'),
			], JSON_PRETTY_PRINT);
		`,
	});
	console.log(
		'📂 [DRUPAL:unzipDrupal] Verify after copy:',
		verifyResult.text
	);

	// Cleanup
	console.log('📂 [DRUPAL:unzipDrupal] Cleaning up tempDir');
	php.rmdir(tempDir, { recursive: true });

	console.log('📂 [DRUPAL:unzipDrupal] ========== END ==========');
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
