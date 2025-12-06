import type { ReadableFilesystemBackend } from '@wp-playground/storage';
import type {
	BlueprintV1,
	BlueprintV1Declaration,
	ExtraLibrary,
	PHPConstants,
} from './v1/types';
import type {
	BlueprintV2,
	BlueprintV2Declaration,
} from './v2/blueprint-v2-declaration';
import type { SupportedPHPVersion } from '@php-wasm/universal';

/**
 * A filesystem structure containing a /blueprint.json file and any
 * resources referenced by that blueprint.
 */
export type BlueprintBundle = ReadableFilesystemBackend;

export type BlueprintDeclaration =
	| BlueprintV1Declaration
	| BlueprintV2Declaration;
export type Blueprint = BlueprintV1 | BlueprintV2;

/**
 * The type of CMS to run in the Playground.
 * Defaults to 'wordpress' for backwards compatibility.
 */
export type CMSType = 'wordpress' | 'drupal';

export interface RuntimeConfiguration {
	/**
	 * The CMS type to run.
	 * @default 'wordpress'
	 */
	cmsType?: CMSType;
	phpVersion: SupportedPHPVersion;
	/**
	 * WordPress version (when cmsType is 'wordpress').
	 */
	wpVersion: string;
	/**
	 * Drupal version (when cmsType is 'drupal').
	 */
	drupalVersion?: string;
	intl: boolean;
	networking: boolean;
	extraLibraries: ExtraLibrary[];
	constants: PHPConstants;
}
