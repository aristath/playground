import { getDrupalModuleDetails } from './get-drupal-module-details';

/**
 * Fetch a Drupal release as a File object.
 *
 * @param drupalVersion The Drupal version to fetch (e.g., '9.5', '10.2')
 * @returns A File object containing the Drupal zip
 */
export async function getDrupalModule(
	drupalVersion: string = '9.5'
): Promise<File> {
	const { url } = getDrupalModuleDetails(drupalVersion);

	let data: Blob | Buffer;

	if (url.startsWith('/')) {
		// Local file path (for development/testing)
		let path = url;
		if (path.startsWith('/@fs/')) {
			path = path.slice(4);
		}

		const { readFile } = await import('node:fs/promises');
		data = await readFile(path);
	} else {
		// Remote URL - fetch from drupal.org
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(
				`Failed to fetch Drupal ${drupalVersion}: ${response.status} ${response.statusText}`
			);
		}
		data = await response.blob();
	}

	return new File([data as BlobPart], `drupal-${drupalVersion}.zip`, {
		type: 'application/zip',
	});
}
