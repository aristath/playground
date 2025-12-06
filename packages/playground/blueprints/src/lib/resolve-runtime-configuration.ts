import { RecommendedPHPVersion } from '@wp-playground/common';
import { BlueprintReflection } from './reflection';
import type { Blueprint, RuntimeConfiguration } from './types';
import { compileBlueprintV1 } from './v1/compile';
import type { BlueprintV1, BlueprintV1Declaration } from './v1/types';
import { isBlueprintBundle } from './v1/compile';
import { getBlueprintDeclaration } from './v1/compile';

export async function resolveRuntimeConfiguration(
	blueprint: Blueprint
): Promise<RuntimeConfiguration> {
	const reflection = await BlueprintReflection.create(blueprint);
	if (reflection.getVersion() === 1) {
		const compiledBlueprint = await compileBlueprintV1(
			blueprint as BlueprintV1
		);

		// Extract cmsType from the blueprint declaration
		let cmsType: 'wordpress' | 'drupal' = 'wordpress';
		if (isBlueprintBundle(blueprint as BlueprintV1)) {
			const declaration = await getBlueprintDeclaration(
				blueprint as BlueprintV1
			);
			cmsType = declaration.cmsType || 'wordpress';
		} else {
			cmsType =
				(blueprint as BlueprintV1Declaration).cmsType || 'wordpress';
		}

		return {
			cmsType,
			wpVersion: compiledBlueprint.versions.wp,
			phpVersion: compiledBlueprint.versions.php,
			// For Drupal, use the default version (we'll add version selection later)
			drupalVersion: cmsType === 'drupal' ? '9.5' : undefined,
			intl: compiledBlueprint.features.intl,
			networking: compiledBlueprint.features.networking,
			extraLibraries: compiledBlueprint.extraLibraries,
			/*
			 * Constants don't matter so much for temporary sites so let's
			 * use an empty object here. We can't easily figure out which
			 * additional constants were applied via playground.defineConstant()
			 * at this stage anyway.
			 *
			 * This property is only relevant for stored sites to ensure they're
			 * consistently applied across page reloads.
			 */
			constants: {},
		};
	} else {
		// @TODO: actually compute the runtime configuration based on the resolved Blueprint v2
		return {
			cmsType: 'wordpress',
			phpVersion: RecommendedPHPVersion,
			wpVersion: 'latest',
			intl: false,
			networking: true,
			constants: {},
			extraLibraries: [],
		};
	}
}
