/**
 * WordPress Playground Plugin Proxy Worker
 *
 * Proxies requests to GitHub API and WordPress.org for plugin/theme downloads.
 * This worker requires a GITHUB_TOKEN secret for GitHub API authentication.
 */

export interface Env {
	GITHUB_TOKEN: string;
}

// Allowed GitHub organizations (lowercase for case-insensitive matching)
const ALLOWED_ORGS = ['wordpress', 'automattic', 'woocommerce'];

// Allowed domains for URL proxy
const ALLOWED_DOMAINS = [
	'api.wordpress.org',
	'w.org',
	'wordpress.org',
	's.w.org',
];

// Headers to pass through from upstream responses
const ALLOWED_RESPONSE_HEADERS = [
	'content-length',
	'content-disposition',
	'x-frame-options',
	'last-modified',
	'etag',
	'date',
	'age',
	'vary',
	'cache-control',
];

class ApiException extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ApiException';
	}
}

/**
 * Make a request to the GitHub API
 */
async function githubRequest(
	url: string,
	token: string,
	followRedirects = true
): Promise<{ body: unknown; headers: Headers; status: number }> {
	const response = await fetch(url, {
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
			Authorization: `Bearer ${token}`,
		},
		redirect: followRedirects ? 'follow' : 'manual',
	});

	let body: unknown = null;
	if (followRedirects && response.ok) {
		const text = await response.text();
		try {
			body = JSON.parse(text);
		} catch {
			body = text;
		}
	}

	return {
		body,
		headers: response.headers,
		status: response.status,
	};
}

/**
 * Stream a response from an upstream URL
 */
async function streamFromUrl(
	url: string,
	defaultHeaders: Record<string, string> = {}
): Promise<Response> {
	const response = await fetch(url, {
		redirect: 'follow',
	});

	if (!response.ok) {
		throw new ApiException('Request failed');
	}

	const headers = new Headers();

	// Copy allowed headers from upstream
	for (const name of ALLOWED_RESPONSE_HEADERS) {
		const value = response.headers.get(name);
		if (value) {
			headers.set(name, value);
		}
	}

	// Add default headers (won't overwrite existing)
	for (const [name, value] of Object.entries(defaultHeaders)) {
		if (!headers.has(name)) {
			headers.set(name, value);
		}
	}

	headers.set('Access-Control-Allow-Origin', '*');

	return new Response(response.body, {
		status: response.status,
		headers,
	});
}

/**
 * Stream plugin or theme from WordPress.org directory
 */
async function streamFromDirectory(
	name: string,
	directory: 'plugins' | 'theme'
): Promise<Response> {
	// Sanitize name
	const sanitizedName = name.replace(/[^a-zA-Z0-9.\-_]/g, '');
	const zipUrl = `https://downloads.wordpress.org/${directory}/${sanitizedName}`;

	return streamFromUrl(zipUrl, {
		'Content-Type': 'application/zip',
		'Content-Disposition': 'attachment; filename="plugin.zip"',
	});
}

/**
 * Stream artifact from GitHub Actions workflow
 */
async function streamArtifactFromBranch(
	token: string,
	organization: string,
	repo: string,
	branchName: string,
	workflowName: string,
	artifactName: string,
	verifyOnly: boolean
): Promise<Response> {
	const encodedBranch = encodeURIComponent(branchName);
	const ciRunsResponse = await githubRequest(
		`https://api.github.com/repos/${organization}/${repo}/actions/runs?branch=${encodedBranch}`,
		token
	);

	const ciRuns = ciRunsResponse.body as {
		workflow_runs?: Array<{ name: string; artifacts_url: string }>;
	};

	if (!ciRuns?.workflow_runs?.length) {
		throw new ApiException('no_ci_runs');
	}

	const artifactsUrls: string[] = [];
	for (const run of ciRuns.workflow_runs) {
		if (run.name === workflowName) {
			artifactsUrls.push(run.artifacts_url);
		}
	}

	if (!artifactsUrls.length) {
		throw new ApiException('artifact_not_found');
	}

	for (const artifactsUrl of artifactsUrls) {
		const artifactsResponse = await githubRequest(artifactsUrl, token);
		const artifacts = artifactsResponse.body as {
			artifacts?: Array<{
				name: string;
				size_in_bytes: number;
				expired: boolean;
				archive_download_url: string;
			}>;
		};

		if (!artifacts?.artifacts) {
			continue;
		}

		for (const artifact of artifacts.artifacts) {
			// Support prefix matching if artifact name ends with '-'
			const isMatch = artifactName.endsWith('-')
				? artifact.name.startsWith(artifactName)
				: artifact.name === artifactName;

			if (!isMatch) {
				continue;
			}

			if (artifact.size_in_bytes < 3000) {
				throw new ApiException('artifact_invalid');
			}

			if (artifact.expired) {
				throw new ApiException('artifact_expired');
			}

			// If verify_only, just return 200 OK
			if (verifyOnly) {
				return new Response(null, { status: 200 });
			}

			// Get the redirect URL from the artifact download endpoint
			const artifactResponse = await githubRequest(
				artifact.archive_download_url,
				token,
				false
			);

			const location = artifactResponse.headers.get('location');
			if (!location) {
				throw new ApiException('artifact_redirect_not_present');
			}

			// Stream from the actual artifact URL
			return streamFromUrl(location, {
				'Content-Type': 'application/zip',
			});
		}
	}

	throw new ApiException('artifact_not_available');
}

/**
 * Stream from GitHub releases
 */
async function streamFromGithubReleases(
	repo: string,
	name: string
): Promise<Response> {
	const zipUrl = `https://github.com/${repo}/releases/latest/download/${name}`;
	return streamFromUrl(zipUrl, {
		'Content-Type': 'application/zip',
		'Content-Disposition': 'attachment; filename="plugin.zip"',
	});
}

/**
 * Stream WordPress build from GitHub
 */
async function streamWordPressBuild(
	token: string,
	buildRef: string
): Promise<Response> {
	let ref = buildRef.toLowerCase();
	let prefix: string;

	if (ref === 'trunk' || ref === 'master') {
		ref = 'master';
		prefix = 'refs/heads/';
	} else if (/^\d+\.\d+$/.test(ref)) {
		// x.x format -> x.x-branch
		ref = `${ref}-branch`;
		prefix = 'refs/heads/';
	} else if (/^\d+\.\d+\.\d+$/.test(ref)) {
		// x.x.x format -> tag, remove trailing .0
		if (ref.endsWith('.0')) {
			ref = ref.slice(0, -2);
		}
		prefix = 'refs/tags/';
	} else if (/^[a-f0-9]{7,40}$/.test(ref)) {
		// Commit hash
		prefix = '';
	} else if (/^\d+\.\d+-branch$/.test(ref)) {
		prefix = 'refs/heads/';
	} else {
		throw new ApiException('artifact_not_found');
	}

	const url = `https://github.com/WordPress/WordPress/archive/${prefix}${ref}.zip`;
	const response = await githubRequest(url, token, false);

	const location = response.headers.get('location');
	if (!location) {
		throw new ApiException('artifact_not_found');
	}

	return streamFromUrl(location, {
		'Content-Disposition': 'attachment; filename="wordpress.zip"',
	});
}

/**
 * Proxy URL request to allowed domains
 */
async function proxyUrl(
	targetUrl: string,
	method: string,
	headers: Headers,
	body: ReadableStream<Uint8Array> | null
): Promise<Response> {
	let parsed: URL;
	try {
		parsed = new URL(targetUrl);
	} catch {
		return new Response('Invalid URL', { status: 400 });
	}

	if (!ALLOWED_DOMAINS.includes(parsed.hostname)) {
		return new Response('Error: The specified URL is not allowed.', {
			status: 403,
		});
	}

	// Filter request headers
	const proxyHeaders = new Headers();
	const blockedHeaders = new Set([
		'authorization',
		'cookie',
		'host',
		'origin',
		'referer',
	]);

	headers.forEach((value, name) => {
		const lowerName = name.toLowerCase();
		if (!blockedHeaders.has(lowerName) && !lowerName.startsWith('sec-')) {
			proxyHeaders.set(name, value);
		}
	});

	const response = await fetch(targetUrl, {
		method,
		headers: proxyHeaders,
		body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
	});

	// Return response with all headers
	return new Response(response.body, {
		status: response.status,
		headers: response.headers,
	});
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const url = new URL(request.url);
		const params = url.searchParams;

		// Add CORS header if no URL param
		const corsHeaders = !params.has('url')
			? { 'Access-Control-Allow-Origin': '*' }
			: {};

		try {
			// Handle plugin download from WordPress.org
			if (params.has('plugin')) {
				return await streamFromDirectory(
					params.get('plugin')!,
					'plugins'
				);
			}

			// Handle theme download from WordPress.org
			if (params.has('theme')) {
				return await streamFromDirectory(params.get('theme')!, 'theme');
			}

			// Handle GitHub PR artifact
			if (
				params.has('org') &&
				params.has('repo') &&
				params.has('workflow') &&
				params.has('pr') &&
				params.has('artifact')
			) {
				const org = params.get('org')!.toLowerCase();
				if (!ALLOWED_ORGS.includes(org)) {
					throw new ApiException(
						'Invalid org. This organization is not allowed.'
					);
				}

				// Get PR details to find branch
				const prResponse = await githubRequest(
					`https://api.github.com/repos/${params.get('org')}/${params.get('repo')}/pulls/${params.get('pr')}`,
					env.GITHUB_TOKEN
				);
				const prDetails = prResponse.body as {
					head?: { ref?: string };
				};
				if (!prDetails?.head?.ref) {
					throw new ApiException('invalid_pr_number');
				}

				return await streamArtifactFromBranch(
					env.GITHUB_TOKEN,
					params.get('org')!,
					params.get('repo')!,
					prDetails.head.ref,
					params.get('workflow')!,
					params.get('artifact')!,
					params.has('verify_only')
				);
			}

			// Handle GitHub branch artifact
			if (
				params.has('org') &&
				params.has('repo') &&
				params.has('workflow') &&
				params.has('branch') &&
				params.has('artifact')
			) {
				const org = params.get('org')!.toLowerCase();
				if (!ALLOWED_ORGS.includes(org)) {
					throw new ApiException(
						'Invalid org. This organization is not allowed.'
					);
				}

				return await streamArtifactFromBranch(
					env.GITHUB_TOKEN,
					params.get('org')!,
					params.get('repo')!,
					params.get('branch')!,
					params.get('workflow')!,
					params.get('artifact')!,
					params.has('verify_only')
				);
			}

			// Handle GitHub releases download
			if (params.has('repo') && params.has('name')) {
				const repo = params.get('repo')!;
				const parts = repo.split('/');
				if (parts.length !== 2) {
					throw new ApiException(
						'Invalid repo format. Expected "organization/repository".'
					);
				}

				if (!ALLOWED_ORGS.includes(parts[0].toLowerCase())) {
					throw new ApiException(
						'Invalid repo. Organization not allowed.'
					);
				}

				return await streamFromGithubReleases(
					repo,
					params.get('name')!
				);
			}

			// Handle WordPress build download
			if (params.has('build-ref')) {
				return await streamWordPressBuild(
					env.GITHUB_TOKEN,
					params.get('build-ref')!
				);
			}

			// Handle URL proxy
			if (params.has('url')) {
				return await proxyUrl(
					params.get('url')!,
					request.method,
					request.headers,
					request.body
				);
			}

			throw new ApiException('Invalid query parameters');
		} catch (error) {
			const message =
				error instanceof ApiException
					? error.message
					: 'Internal error';
			return new Response(JSON.stringify({ error: message }), {
				status: 400,
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders,
				},
			});
		}
	},
};
