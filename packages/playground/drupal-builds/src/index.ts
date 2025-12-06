/**
 * @wp-playground/drupal-builds
 *
 * Drupal version management and download utilities for WordPress Playground.
 * Provides functions to fetch and manage Drupal releases.
 */

export { getDrupalModuleDetails } from './drupal/get-drupal-module-details';
export { getDrupalModule } from './drupal/get-drupal-module';
import DrupalVersions from './drupal/drupal-versions.json';

export { DrupalVersions };

/**
 * List of supported Drupal versions.
 */
export const DrupalVersionsList = Object.keys(DrupalVersions) as string[];

/**
 * The latest supported Drupal version.
 */
export const LatestDrupalVersion = DrupalVersionsList[0] as string;

/**
 * Convert a Drupal version string to a static assets directory name.
 *
 * @param drupalVersion The Drupal version (e.g., '9.5')
 * @returns The directory name (e.g., 'drupal-9.5') or undefined if not supported
 */
export function drupalVersionToStaticAssetsDirectory(
	drupalVersion: string
): string | undefined {
	return drupalVersion in DrupalVersions
		? `drupal-${drupalVersion}`
		: undefined;
}
