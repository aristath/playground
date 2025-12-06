import type { StepHandler } from '.';
import type { InstallAssetOptions } from './install-asset';
import { installAsset } from './install-asset';
import { zipNameToHumanName } from '../utils/zip-name-to-human-name';
import type { Directory } from '../v1/resources';
import { joinPaths } from '@php-wasm/util';
import { writeFiles } from '@php-wasm/universal';
import { logger } from '@php-wasm/logger';

/**
 * @inheritDoc installDrupalTheme
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "installDrupalTheme",
 * 		"themeData": {
 * 			"resource": "url",
 * 			"url": "https://ftp.drupal.org/files/projects/bootstrap-8.x-3.0.zip"
 * 		},
 * 		"options": {
 * 			"activate": true
 * 		}
 * }
 * </code>
 */
export interface InstallDrupalThemeStep<
	FileResource,
	DirectoryResource,
> extends Pick<InstallAssetOptions, 'ifAlreadyInstalled'> {
	/**
	 * The step identifier.
	 */
	step: 'installDrupalTheme';
	/**
	 * The theme files to install. It can be a theme zip file or a directory
	 * containing all the theme files at its root.
	 */
	themeData: FileResource | DirectoryResource;

	/**
	 * Optional installation options.
	 */
	options?: InstallDrupalThemeOptions;
}

export interface InstallDrupalThemeOptions {
	/**
	 * Whether to set this theme as the default after installing it.
	 * Note: This requires Drush to be available.
	 */
	activate?: boolean;
	/**
	 * The name of the folder to install the theme to.
	 * Defaults to guessing from themeData.
	 */
	targetFolderName?: string;
}

/**
 * Installs a Drupal theme in the Playground.
 *
 * Drupal themes are installed to /themes/contrib/ by convention.
 *
 * @param playground The playground client.
 * @param themeData The theme zip file or directory.
 * @param options Optional. Set `activate` to true to set it as the default theme.
 */
export const installDrupalTheme: StepHandler<
	InstallDrupalThemeStep<File, Directory>
> = async (
	playground,
	{ themeData, ifAlreadyInstalled, options = {} },
	progress?
) => {
	const documentRoot = await playground.documentRoot;

	// Drupal themes go in /themes/contrib/ (or /themes/custom/ for custom themes)
	const themesDirectoryPath = joinPaths(documentRoot, 'themes', 'contrib');

	// Ensure the contrib directory exists
	if (!(await playground.fileExists(themesDirectoryPath))) {
		const themesPath = joinPaths(documentRoot, 'themes');
		if (!(await playground.fileExists(themesPath))) {
			await playground.mkdir(themesPath);
		}
		await playground.mkdir(themesDirectoryPath);
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
		const matchesZipSignature =
			filePrefix[0] === 0x50 &&
			filePrefix[1] === 0x4b &&
			filePrefix[2] === 0x03 &&
			filePrefix[3] === 0x04;
		return matchesZipSignature;
	};

	if (themeData instanceof File) {
		if (await looksLikeZipFile(themeData)) {
			const zipFileName = themeData.name.split('/').pop() || 'theme.zip';
			assetNiceName = zipNameToHumanName(zipFileName);

			progress?.tracker.setCaption(
				`Installing the ${assetNiceName} theme`
			);
			const assetResult = await installAsset(playground, {
				ifAlreadyInstalled,
				zipFile: themeData,
				targetPath: themesDirectoryPath,
				targetFolderName: targetFolderName,
			});
			assetFolderPath = assetResult.assetFolderPath;
			assetNiceName = assetResult.assetFolderName;
		} else {
			throw new Error(
				'themeData looks like a file but does not look like a .zip file. ' +
					'Drupal themes must be provided as zip files or directories.'
			);
		}
	} else if (themeData) {
		assetNiceName = themeData.name;
		progress?.tracker.setCaption(`Installing the ${assetNiceName} theme`);

		const themeDirectoryPath = joinPaths(
			themesDirectoryPath,
			targetFolderName || themeData.name
		);
		await writeFiles(playground, themeDirectoryPath, themeData.files, {
			rmRoot: true,
		});
		assetFolderPath = themeDirectoryPath;
	}

	// Set as default theme if requested
	const activate = 'activate' in options ? options.activate : false;

	if (activate) {
		// To set the default theme, we need Drush
		const drushPath = '/tmp/drush.phar';
		if (await playground.fileExists(drushPath)) {
			const themeName = assetNiceName
				.toLowerCase()
				.replace(/[^a-z0-9_]/g, '_');
			logger.log(`Setting default Drupal theme: ${themeName}`);

			try {
				// First, enable the theme
				await playground.run({
					code: `<?php
						$GLOBALS['argv'] = [
							'${drushPath}',
							'--root=${documentRoot}',
							'theme:enable',
							'${themeName}',
							'-y'
						];
						define('STDIN', fopen('php://stdin', 'rb'));
						define('STDOUT', fopen('php://stdout', 'wb'));
						define('STDERR', fopen('php://stderr', 'wb'));
						require('${drushPath}');
					`,
				});

				// Then, set it as default
				await playground.run({
					code: `<?php
						$GLOBALS['argv'] = [
							'${drushPath}',
							'--root=${documentRoot}',
							'config:set',
							'system.theme',
							'default',
							'${themeName}',
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
					`Failed to set theme ${themeName} as default. You may need to do this manually.`,
					e
				);
			}
		} else {
			logger.warn(
				`Cannot set theme ${assetNiceName} as default: Drush is not available. ` +
					`Add "drush" to extraLibraries to enable automatic theme activation.`
			);
		}
	}

	return {
		assetFolderPath,
		assetFolderName: assetNiceName,
	};
};
