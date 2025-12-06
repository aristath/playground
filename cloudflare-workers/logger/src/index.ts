/**
 * WordPress Playground Logger Worker
 *
 * Sends error logs and feedback to Slack.
 * Requires SLACK_CHANNEL and SLACK_TOKEN secrets.
 * Uses Cloudflare's Rate Limiting for abuse prevention.
 */

export interface Env {
	SLACK_CHANNEL: string;
	SLACK_TOKEN: string;
	// KV namespace for rate limiting (optional, Cloudflare rate limiting is preferred)
	RATE_LIMIT_KV?: KVNamespace;
}

interface LoggerRequest {
	description: string;
	logs?: string;
	url?: string;
	context?: string;
	blueprint?: string;
}

const MAX_REQUESTS_PER_HOUR = 5;

/**
 * Send JSON response
 */
function jsonResponse(ok: boolean, error?: string, status = 200): Response {
	const body: { ok: boolean; error?: string } = { ok };
	if (error) {
		body.error = error;
	}
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
}

/**
 * Check rate limit using KV (if available)
 * Returns true if request should be allowed
 */
async function checkRateLimit(env: Env, clientId: string): Promise<boolean> {
	if (!env.RATE_LIMIT_KV) {
		// If no KV namespace, rely on Cloudflare's rate limiting rules
		return true;
	}

	const hourKey = `logger_${clientId}_${new Date().toISOString().slice(0, 13)}`;
	const currentCount = parseInt(
		(await env.RATE_LIMIT_KV.get(hourKey)) || '0'
	);

	if (currentCount >= MAX_REQUESTS_PER_HOUR) {
		return false;
	}

	// Increment counter with 1 hour expiration
	await env.RATE_LIMIT_KV.put(hourKey, String(currentCount + 1), {
		expirationTtl: 3600,
	});

	return true;
}

/**
 * Validate URL
 */
function isValidUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		// Handle CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		// Only accept POST requests
		if (request.method !== 'POST') {
			return jsonResponse(false, 'Method not allowed', 405);
		}

		// Check for required secrets
		if (!env.SLACK_TOKEN) {
			return jsonResponse(false, 'No token provided', 500);
		}

		// Get client identifier for rate limiting
		const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';

		// Check rate limit
		const allowed = await checkRateLimit(env, clientIp);
		if (!allowed) {
			return jsonResponse(false, 'Too many requests', 429);
		}

		// Parse request body
		let data: LoggerRequest;
		try {
			const contentType = request.headers.get('Content-Type') || '';

			if (contentType.includes('application/json')) {
				data = await request.json();
			} else if (
				contentType.includes('application/x-www-form-urlencoded')
			) {
				const formData = await request.formData();
				data = {
					description: formData.get('description') as string,
					logs: formData.get('logs') as string | undefined,
					url: formData.get('url') as string | undefined,
					context: formData.get('context') as string | undefined,
					blueprint: formData.get('blueprint') as string | undefined,
				};
			} else {
				return jsonResponse(false, 'Invalid content type', 400);
			}
		} catch {
			return jsonResponse(false, 'Invalid request body', 400);
		}

		// Validate required fields
		if (!data.description) {
			return jsonResponse(false, 'No description provided', 400);
		}

		// Validate URL if provided
		if (data.url && !isValidUrl(data.url)) {
			return jsonResponse(false, 'Invalid URL', 400);
		}

		// Build message text
		let text = `How can we recreate this error?\n\n${data.description}`;

		if (data.logs) {
			text += `\n\nLogs\n\n${data.logs}`;
		}

		if (data.url) {
			text += `\n\nUrl\n\n${data.url}`;
		}

		if (data.context) {
			text += `\n\nContext\n\n${data.context}`;
		}

		if (data.blueprint) {
			text += `\n\nBlueprint\n\n${data.blueprint}`;
		}

		// Send to Slack
		const slackResponse = await fetch(
			'https://slack.com/api/chat.postMessage',
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.SLACK_TOKEN}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					channel: env.SLACK_CHANNEL,
					text: text,
				}),
			}
		);

		if (!slackResponse.ok) {
			return jsonResponse(
				false,
				`HTTP Error: ${slackResponse.status}`,
				500
			);
		}

		const slackData = (await slackResponse.json()) as {
			ok: boolean;
			error?: string;
		};

		if (!slackData.ok) {
			return jsonResponse(false, `Slack Error: ${slackData.error}`, 500);
		}

		return jsonResponse(true);
	},
};
