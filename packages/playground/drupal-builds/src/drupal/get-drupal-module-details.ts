import DrupalVersions from './drupal-versions.json';

/**
 * Supported Drupal versions that have bundled static files.
 */
const SupportedDrupalVersions = Object.keys(DrupalVersions) as string[];

/**
 * Get details about a Drupal module for a specific version.
 *
 * Uses locally bundled static files for supported versions,
 * falls back to drupal.org for unsupported versions.
 */
export function getDrupalModuleDetails(drupalVersion: string = '9.5'): {
	size: number;
	url: string;
} {
	// Approximate sizes (actual sizes vary)
	const sizeMap: Record<string, number> = {
		'9.5': 35_000_000, // ~35MB
	};

	if (SupportedDrupalVersions.includes(drupalVersion)) {
		// Use the locally bundled static file
		return {
			size: sizeMap[drupalVersion] || 35_000_000,
			url: `/drupal-${drupalVersion}/drupal-${drupalVersion}.zip`,
		};
	}

	// Fallback to drupal.org for unsupported versions
	// Map short versions to full versions
	const versionMap: Record<string, string> = {
		'9.5': '9.5.11',
		'9.4': '9.4.15',
		'9.3': '9.3.22',
		'10.0': '10.0.11',
		'10.1': '10.1.8',
		'10.2': '10.2.7',
		'10.3': '10.3.6',
	};

	const fullVersion = versionMap[drupalVersion] || drupalVersion;
	const url = `https://ftp.drupal.org/files/projects/drupal-${fullVersion}.zip`;

	return {
		size: 35_000_000,
		url,
	};
}
