/**
 * WordPress Playground OAuth Worker
 *
 * Handles GitHub OAuth authentication flow.
 * Requires CLIENT_ID and CLIENT_SECRET secrets.
 */

export interface Env {
	CLIENT_ID: string;
	CLIENT_SECRET: string;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		const url = new URL(request.url);
		const params = url.searchParams;

		// Handle redirect to GitHub OAuth
		if (params.get('redirect') === '1') {
			// Always redirect to the current host for security
			const redirectHost = url.host;
			const redirectUri = params.get('redirect_uri');

			let finalRedirectUri = '';
			if (redirectUri) {
				try {
					const parsedRedirect = new URL(redirectUri);
					// Only use the query string, not the host/path from redirect_uri
					finalRedirectUri = `https://${redirectHost}?${parsedRedirect.search.slice(1)}`;
				} catch {
					finalRedirectUri = `https://${redirectHost}`;
				}
			}

			const authUrl = new URL('https://github.com/login/oauth/authorize');
			authUrl.searchParams.set('client_id', env.CLIENT_ID);
			authUrl.searchParams.set('scope', 'repo');
			if (finalRedirectUri) {
				authUrl.searchParams.set('redirect_uri', finalRedirectUri);
			}

			return Response.redirect(authUrl.toString(), 302);
		}

		// Handle OAuth code exchange
		const code = params.get('code');
		if (!code) {
			return new Response(
				JSON.stringify({ error: 'Missing code parameter' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				}
			);
		}

		// Exchange code for access token
		const tokenResponse = await fetch(
			'https://github.com/login/oauth/access_token',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Accept: 'application/json',
				},
				body: new URLSearchParams({
					client_id: env.CLIENT_ID,
					client_secret: env.CLIENT_SECRET,
					code: code,
				}),
			}
		);

		const tokenData = await tokenResponse.json();

		return new Response(JSON.stringify(tokenData), {
			headers: { 'Content-Type': 'application/json' },
		});
	},
};
