import type { StepHandler } from '.';
import type { InstallAssetOptions } from './install-asset';
import { installAsset } from './install-asset';
import { writeFile } from './write-file';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import type { Directory } from '../v1/resources';
import { joinPaths } from '@php-wasm/util';
import { writeFiles } from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';

/**
 * @inheritDoc installDrupalModule
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "installDrupalModule",
 * 		"moduleData": {
 * 			"resource": "url",
 * 			"url": "https://ftp.drupal.org/files/projects/views-8.x-3.0.zip"
 * 		},
 * 		"options": {
 * 			"activate": true
 * 		}
 * }
 * </code>
 */
export interface InstallDrupalModuleStep<
	FileResource,
	DirectoryResource,
> extends Pick<InstallAssetOptions, 'ifAlreadyInstalled'> {
	/**
	 * The step identifier.
	 */
	step: 'installDrupalModule';
	/**
	 * The module files to install. It can be a module zip file or a directory
	 * containing all the module files at its root.
	 */
	moduleData: FileResource | DirectoryResource;

	/**
	 * Optional installation options.
	 */
	options?: InstallDrupalModuleOptions;
}

export interface InstallDrupalModuleOptions {
	/**
	 * Whether to enable the module after installing it.
	 * Note: This requires Drush to be available.
	 */
	activate?: boolean;
	/**
	 * The name of the folder to install the module to.
	 * Defaults to guessing from moduleData.
	 */
	targetFolderName?: string;
}

/**
 * Installs a Drupal module in the Playground.
 *
 * Drupal modules are installed to /modules/contrib/ by convention.
 *
 * @param playground The playground client.
 * @param moduleData The module zip file or directory.
 * @param options Optional. Set `activate` to false if you don't want to enable the module.
 */
export const installDrupalModule: StepHandler<
	InstallDrupalModuleStep<File, Directory>
> = async (
	playground,
	{ moduleData, ifAlreadyInstalled, options = {} },
	progress?
) => {
	const documentRoot = await playground.documentRoot;

	// Drupal modules go in /modules/contrib/ (or /modules/custom/ for custom modules)
	const modulesDirectoryPath = joinPaths(documentRoot, 'modules', 'contrib');

	// Ensure the contrib directory exists
	if (!(await playground.fileExists(modulesDirectoryPath))) {
		const modulesPath = joinPaths(documentRoot, 'modules');
		if (!(await playground.fileExists(modulesPath))) {
			await playground.mkdir(modulesPath);
		}
		await playground.mkdir(modulesDirectoryPath);
	}

	const targetFolderName =
		'targetFolderName' in options ? options.targetFolderName : '';
	let assetFolderPath = '';
	let assetNiceName = '';

	const looksLikeZipFile = async (file: File): Promise<boolean> => {
		if (file.name.toLowerCase().endsWith('.zip')) {
			return true;
		}

		const filePrefix = new Uint8Array(await file.arrayBuffer(), 0, 4);
		// Check against the signature for non-empty, non-spanned zip files.
		const matchesZipSignature =
			filePrefix[0] === 0x50 &&
			filePrefix[1] === 0x4b &&
			filePrefix[2] === 0x03 &&
			filePrefix[3] === 0x04;
		return matchesZipSignature;
	};

	if (moduleData instanceof File) {
		if (await looksLikeZipFile(moduleData)) {
			const zipFileName =
				moduleData.name.split('/').pop() || 'module.zip';
			assetNiceName = zipNameToHumanName(zipFileName);

			progress?.tracker.setCaption(
				`Installing the ${assetNiceName} module`
			);
			const assetResult = await installAsset(playground, {
				ifAlreadyInstalled,
				zipFile: moduleData,
				targetPath: modulesDirectoryPath,
				targetFolderName: targetFolderName,
			});
			assetFolderPath = assetResult.assetFolderPath;
			assetNiceName = assetResult.assetFolderName;
		} else {
			throw new Error(
				'moduleData looks like a file but does not look like a .zip file. ' +
					'Drupal modules must be provided as zip files or directories.'
			);
		}
	} else if (moduleData) {
		assetNiceName = moduleData.name;
		progress?.tracker.setCaption(`Installing the ${assetNiceName} module`);

		const moduleDirectoryPath = joinPaths(
			modulesDirectoryPath,
			targetFolderName || moduleData.name
		);
		await writeFiles(playground, moduleDirectoryPath, moduleData.files, {
			rmRoot: true,
		});
		assetFolderPath = moduleDirectoryPath;
	}

	// Enable the module if requested
	const activate = 'activate' in options ? options.activate : false;

	if (activate) {
		// To enable modules, we need Drush
		// Check if Drush is available
		const drushPath = '/tmp/drush.phar';
		if (await playground.fileExists(drushPath)) {
			// Enable the module using Drush
			const moduleName = assetNiceName
				.toLowerCase()
				.replace(/[^a-z0-9_]/g, '_');
			logger.log(`Enabling Drupal module: ${moduleName}`);

			try {
				await playground.run({
					code: `<?php
						$GLOBALS['argv'] = [
							'${drushPath}',
							'--root=${documentRoot}',
							'pm:enable',
							'${moduleName}',
							'-y'
						];
						define('STDIN', fopen('php://stdin', 'rb'));
						define('STDOUT', fopen('php://stdout', 'wb'));
						define('STDERR', fopen('php://stderr', 'wb'));
						require('${drushPath}');
					`,
				});
			} catch (e) {
				logger.warn(
					`Failed to enable module ${moduleName}. You may need to enable it manually.`,
					e
				);
			}
		} else {
			logger.warn(
				`Cannot enable module ${assetNiceName}: Drush is not available. ` +
					`Add "drush" to extraLibraries to enable automatic module activation.`
			);
		}
	}

	return {
		assetFolderPath,
		assetFolderName: assetNiceName,
	};
};
