import { EmscriptenDownloadMonitor } from '@php-wasm/progress';
import { exposeAPI } from '@php-wasm/web';
import { PlaygroundWorkerEndpoint } from './playground-worker-endpoint';
import { randomString } from '@php-wasm/util';
import {
	getSqliteDriverModuleDetails,
	getWordPressModuleDetails,
	LatestMinifiedWordPressVersion,
	LatestSqliteDriverVersion,
	MinifiedWordPressVersionsList,
} from '@wp-playground/wordpress-builds';
import {
	getDrupalModuleDetails,
	LatestDrupalVersion,
} from '@wp-playground/drupal-builds';
import { directoryHandleFromMountDevice } from '@wp-playground/storage';
import { bootWordPress } from '@wp-playground/wordpress';
import { bootDrupal } from '@wp-playground/drupal';
import { createDirectoryHandleMountHandler } from '@php-wasm/web';
import type { PHP } from '@php-wasm/universal';
/* @ts-ignore */
import { corsProxyUrl as defaultCorsProxyUrl } from 'virtual:cors-proxy-url';
import type { WorkerBootOptions } from './playground-worker-endpoint';
import { DrupalFetchNetworkTransport } from './drupal-fetch-network-transport';
/* @ts-ignore */
import drupalHttpFetch from './playground-mu-plugin/drupal_http_fetch.php?raw';
/* @ts-ignore */
import drupalStreamWrapper from './playground-mu-plugin/drupal_stream_wrapper.php?raw';

// post message to parent
console.log('🚀 [WORKER:blueprints-v1] ===== SCRIPT LOADED =====');
self.postMessage('worker-script-started');

const downloadMonitor = new EmscriptenDownloadMonitor();
console.log('🚀 [WORKER:blueprints-v1] downloadMonitor created');

class ArtifactExpiredError extends Error {
	constructor(message = 'GitHub artifact expired') {
		super(message);
		this.name = 'ArtifactExpiredError';
	}
}

class PlaygroundWorkerEndpointBlueprintsV1 extends PlaygroundWorkerEndpoint {
	private currentCmsType: 'wordpress' | 'drupal' = 'wordpress';
	private drupalNetworkTransport: DrupalFetchNetworkTransport | undefined;

	constructor(monitor: EmscriptenDownloadMonitor) {
		super(monitor);
		console.log(
			'🚀 [WORKER:PlaygroundWorkerEndpointBlueprintsV1] Constructor called'
		);
	}

	override async boot({
		scope,
		mounts = [],
		cmsType = 'wordpress',
		wpVersion = LatestMinifiedWordPressVersion,
		drupalVersion = LatestDrupalVersion,
		sqliteDriverVersion = LatestSqliteDriverVersion,
		phpVersion,
		sapiName = 'cli',
		withIntl = false,
		withNetworking = true,
		shouldInstallWordPress = true,
		corsProxyUrl,
	}: WorkerBootOptions) {
		console.log(
			'🚀 [WORKER:boot] ==================== BOOT START ===================='
		);
		console.log(
			'🚀 [WORKER:boot] FULL OPTIONS:',
			JSON.stringify(
				{
					scope,
					mountsCount: mounts.length,
					cmsType,
					wpVersion,
					drupalVersion,
					sqliteDriverVersion,
					phpVersion,
					sapiName,
					withIntl,
					withNetworking,
					shouldInstallWordPress,
					corsProxyUrl: corsProxyUrl ? 'set' : 'unset',
				},
				null,
				2
			)
		);

		if (this.booted) {
			console.log('🚀 [WORKER:boot] ERROR: Already booted!');
			throw new Error('Playground already booted');
		}
		if (corsProxyUrl === undefined) {
			console.log('🚀 [WORKER:boot] Using default CORS proxy URL');
			corsProxyUrl = defaultCorsProxyUrl as any;
		}
		console.log('🚀 [WORKER:boot] corsProxyUrl resolved:', corsProxyUrl);

		this.booted = true;
		this.scope = scope;
		this.currentCmsType = cmsType;
		console.log(
			'🚀 [WORKER:boot] State set: booted=true, scope=',
			scope,
			'currentCmsType=',
			cmsType
		);

		try {
			// eslint-disable-next-line @typescript-eslint/no-this-alias
			const endpoint = this;
			const knownRemoteAssetPaths = new Set<string>();
			const siteUrl = this.computeSiteUrl(scope);
			console.log('🚀 [WORKER:boot] siteUrl computed:', siteUrl);

			const targetDocumentRoot =
				cmsType === 'drupal' ? '/drupal' : '/wordpress';
			console.log(
				'🚀 [WORKER:boot] Target documentRoot:',
				targetDocumentRoot
			);

			console.log('🚀 [WORKER:boot] Creating request handler...');
			const requestHandler = await this.createRequestHandler({
				siteUrl,
				sapiName,
				corsProxyUrl,
				knownRemoteAssetPaths,
				withIntl,
				withNetworking,
				phpVersion: phpVersion!,
				documentRoot: targetDocumentRoot,
			});
			console.log(
				'🚀 [WORKER:boot] Request handler created, documentRoot:',
				requestHandler.documentRoot
			);

			if (cmsType === 'drupal') {
				console.log(
					'🚀 [WORKER:boot] CMS type is drupal, calling bootDrupalCMS...'
				);
				// Boot Drupal
				await this.bootDrupalCMS({
					requestHandler,
					siteUrl,
					drupalVersion,
					mounts,
					endpoint,
					shouldInstall: shouldInstallWordPress,
					corsProxyUrl,
					withNetworking,
				});
				console.log('🚀 [WORKER:boot] bootDrupalCMS completed');
			} else {
				console.log(
					'🚀 [WORKER:boot] CMS type is wordpress, calling bootWordPressCMS...'
				);
				// Boot WordPress (default)
				await this.bootWordPressCMS({
					requestHandler,
					siteUrl,
					wpVersion,
					sqliteDriverVersion,
					mounts,
					endpoint,
					shouldInstall: shouldInstallWordPress,
					corsProxyUrl,
				});
				console.log('🚀 [WORKER:boot] bootWordPressCMS completed');
			}

			console.log('🚀 [WORKER:boot] Calling finalizeAfterBoot...');
			await this.finalizeAfterBoot(
				requestHandler,
				withNetworking,
				knownRemoteAssetPaths
			);
			console.log('🚀 [WORKER:boot] finalizeAfterBoot completed');
			setApiReady();
			console.log(
				'🚀 [WORKER:boot] ==================== BOOT END (SUCCESS) ===================='
			);
		} catch (e) {
			console.log(
				'🚀 [WORKER:boot] ==================== BOOT FAILED ===================='
			);
			console.log('🚀 [WORKER:boot] Error:', e);
			setAPIError(e as Error);
			throw e as Error;
		}
	}

	private async bootWordPressCMS({
		requestHandler,
		siteUrl,
		wpVersion,
		sqliteDriverVersion,
		mounts,
		endpoint,
		shouldInstall,
		corsProxyUrl,
	}: {
		requestHandler: any;
		siteUrl: string;
		wpVersion: string;
		sqliteDriverVersion: string;
		mounts: any[];
		endpoint: PlaygroundWorkerEndpointBlueprintsV1;
		shouldInstall: boolean;
		corsProxyUrl?: string;
	}) {
		this.requestedWordPressVersion =
			wpVersion === 'nightly' ? 'trunk' : wpVersion;
		wpVersion = MinifiedWordPressVersionsList.includes(
			this.requestedWordPressVersion
		)
			? this.requestedWordPressVersion
			: LatestMinifiedWordPressVersion;

		const wpDetails = getWordPressModuleDetails(wpVersion);
		let wordPressRequest: Promise<Response> | null = null;
		if (shouldInstall) {
			if (this.requestedWordPressVersion!.startsWith('http')) {
				wordPressRequest = this.downloadMonitor
					.monitorFetch(
						fetch(this.requestedWordPressVersion as string)
					)
					.then((response) => {
						if (response.ok) {
							return response;
						}
						let json: any = null;
						return response.json().then(
							(parsedJson) => {
								json = parsedJson;
								if (json && json.error === 'artifact_expired') {
									throw new ArtifactExpiredError();
								}
								throw new Error(
									`Failed to download WordPress ZIP (HTTP ${response.status})`
								);
							},
							() => {
								throw new Error(
									`Failed to download WordPress ZIP (HTTP ${response.status})`
								);
							}
						);
					});
			} else {
				const downloadUrl = maybeProxyUrl(
					wpDetails.url,
					corsProxyUrl as string | undefined
				);
				this.downloadMonitor.expectAssets({
					[downloadUrl]: wpDetails.size,
				});
				wordPressRequest = this.downloadMonitor.monitorFetch(
					fetch(downloadUrl)
				);
			}
		}

		let sqliteIntegrationRequest: Promise<Response> | null = null;
		const sqliteDriverModuleDetails =
			getSqliteDriverModuleDetails(sqliteDriverVersion);
		this.downloadMonitor.expectAssets({
			[sqliteDriverModuleDetails.url]: sqliteDriverModuleDetails.size,
		});
		sqliteIntegrationRequest = this.downloadMonitor.monitorFetch(
			fetch(sqliteDriverModuleDetails.url)
		);

		await bootWordPress(requestHandler, {
			siteUrl,
			constants: shouldInstall
				? {
						WP_DEBUG: true,
						WP_DEBUG_LOG: true,
						WP_DEBUG_DISPLAY: false,
						AUTH_KEY: randomString(40),
						SECURE_AUTH_KEY: randomString(40),
						LOGGED_IN_KEY: randomString(40),
						NONCE_KEY: randomString(40),
						AUTH_SALT: randomString(40),
						SECURE_AUTH_SALT: randomString(40),
						LOGGED_IN_SALT: randomString(40),
						NONCE_SALT: randomString(40),
					}
				: {},
			wordPressZip: shouldInstall
				? wordPressRequest!
						.then((r) => r.blob())
						.then((b) => new File([b], 'wp.zip'))
				: undefined,
			sqliteIntegrationPluginZip: sqliteIntegrationRequest
				? sqliteIntegrationRequest
						.then((r) => r.blob())
						.then((b) => new File([b], 'sqlite.zip'))
				: undefined,
			hooks: {
				async beforeWordPressFiles(php: PHP) {
					for (const mount of mounts) {
						const handle = await directoryHandleFromMountDevice(
							mount.device
						);
						const unmount = await php.mount(
							mount.mountpoint,
							createDirectoryHandleMountHandler(handle, {
								initialSync: {
									direction: mount.initialSyncDirection,
								},
							})
						);
						endpoint.unmounts[mount.mountpoint] = unmount;
					}
				},
			},
		});
	}

	private async bootDrupalCMS({
		requestHandler,
		siteUrl,
		drupalVersion,
		mounts,
		endpoint,
		shouldInstall,
		corsProxyUrl,
		withNetworking,
	}: {
		requestHandler: any;
		siteUrl: string;
		drupalVersion: string;
		mounts: any[];
		endpoint: PlaygroundWorkerEndpointBlueprintsV1;
		shouldInstall: boolean;
		corsProxyUrl?: string;
		withNetworking?: boolean;
	}) {
		const drupalDetails = getDrupalModuleDetails(drupalVersion);
		let drupalRequest: Promise<Response> | null = null;

		if (shouldInstall) {
			this.downloadMonitor.expectAssets({
				[drupalDetails.url]: drupalDetails.size,
			});
			drupalRequest = this.downloadMonitor.monitorFetch(
				fetch(drupalDetails.url)
			);
		}

		// Set up Drupal network transport BEFORE installation
		// This is critical because Drupal's installer makes network requests
		const primaryPhp = await requestHandler.getPrimaryPhp();
		if (withNetworking) {
			this.drupalNetworkTransport = new DrupalFetchNetworkTransport({
				corsProxyUrl,
			});
			await this.drupalNetworkTransport.setupMessageHandler(primaryPhp);
			await this.drupalNetworkTransport.setEnabled(primaryPhp, true);

			// Write the stream wrapper to preload directory
			// This intercepts ALL http/https requests at PHP level and routes
			// them through the CORS proxy. The 0- prefix ensures it loads first.
			primaryPhp.writeFile(
				'/internal/shared/preload/0-http-stream-wrapper.php',
				drupalStreamWrapper
			);

			// Write the Guzzle handler PHP file so settings.php can include it
			primaryPhp.mkdir('/internal/shared/drupal-includes');
			primaryPhp.writeFile(
				'/internal/shared/drupal-includes/drupal_http_fetch.php',
				drupalHttpFetch
			);
		}

		await bootDrupal(requestHandler, {
			siteUrl,
			drupalZip: shouldInstall
				? drupalRequest!
						.then((r) => r.blob())
						.then((b) => new File([b], 'drupal.zip'))
				: undefined,
			hooks: {
				async beforeDrupalFiles(php: PHP) {
					for (const mount of mounts) {
						const handle = await directoryHandleFromMountDevice(
							mount.device
						);
						const unmount = await php.mount(
							mount.mountpoint,
							createDirectoryHandleMountHandler(handle, {
								initialSync: {
									direction: mount.initialSyncDirection,
								},
							})
						);
						endpoint.unmounts[mount.mountpoint] = unmount;
					}
				},
			},
		});
	}

	protected override async finalizeAfterBoot(
		requestHandler: any,
		withNetworking: boolean,
		knownRemoteAssetPaths: Set<string>
	) {
		// For Drupal, skip WordPress-specific logic (version detection, remote assets)
		if (this.currentCmsType === 'drupal') {
			console.log(
				'🚀 [WORKER:finalizeAfterBoot] Drupal mode - skipping WordPress-specific logic'
			);
			// Just set the request handler, skip WordPress version detection
			this.__internal_setRequestHandler(requestHandler);
			return;
		}

		// For WordPress, use the parent implementation
		return super.finalizeAfterBoot(
			requestHandler,
			withNetworking,
			knownRemoteAssetPaths
		);
	}

	override async getCMSModuleDetails() {
		if (this.currentCmsType === 'drupal') {
			return {
				staticAssetsDirectory: undefined,
				cmsType: 'drupal' as const,
			};
		}
		return super.getCMSModuleDetails();
	}
}

const [setApiReady, setAPIError] = exposeAPI(
	new PlaygroundWorkerEndpointBlueprintsV1(downloadMonitor)
);

function maybeProxyUrl(url: string, corsProxyUrl?: string) {
	if (
		!corsProxyUrl ||
		!url.startsWith('https://github.com/WordPress/WordPress/archive/')
	) {
		return url;
	}
	return `${corsProxyUrl}${url}`;
}
