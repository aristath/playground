# WordPress Playground Cloudflare Workers

This directory contains Cloudflare Workers that power the WordPress Playground infrastructure.

## Workers

### 1. Static Server (`static-server/`)

Serves static files from Cloudflare R2 bucket.

**Features:**

- Serves files from R2 bucket with proper MIME types
- Handles redirects (e.g., `/docs` → documentation)
- Cache control (immutable for hashed assets, no-cache for entry points)
- Range request support for large WASM files
- ETag-based conditional requests

**R2 Bucket Binding:** `PLAYGROUND_BUCKET`

### 2. CORS Proxy (`cors-proxy/`)

Proxies requests to external URLs, adding CORS headers.

**Features:**

- URL extraction from query string (`?https://example.com`)
- Method validation (GET, POST, OPTIONS only)
- Size limits (1MB request, 100MB response)
- Header filtering (removes Cookie, Host; opt-in for Authorization)
- Redirect URL rewriting through proxy
- CORS headers for whitelisted origins
- Private IP blocking

**Dev Port:** 5263

### 3. Plugin Proxy (`plugin-proxy/`)

Proxies requests to GitHub API and WordPress.org for plugin/theme downloads.

**Features:**

- Download plugins/themes from WordPress.org directory
- Download GitHub Actions artifacts from allowed orgs
- Download GitHub releases from allowed repos
- Download WordPress core builds by version/branch/commit
- Proxy requests to allowed WordPress.org domains

**Required Secret:** `GITHUB_TOKEN`
**Dev Port:** 5264

### 4. OAuth (`oauth/`)

Handles GitHub OAuth authentication flow.

**Features:**

- Redirect to GitHub OAuth authorize endpoint
- Exchange authorization code for access token

**Required Secrets:** `CLIENT_ID`, `CLIENT_SECRET`
**Dev Port:** 5265

### 5. Logger (`logger/`)

Sends error logs and feedback to Slack.

**Features:**

- Accept error reports with description, logs, URL, context, blueprint
- Send formatted messages to Slack channel
- Rate limiting (5 requests per hour per IP)

**Required Secrets:** `SLACK_CHANNEL`, `SLACK_TOKEN`
**Dev Port:** 5266

## Development

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account

### Running Locally

Each worker can be run locally with:

```bash
cd <worker-directory>
npm install
npm run dev
```

### Setting Secrets

Secrets must be set for production:

```bash
# Plugin Proxy
wrangler secret put GITHUB_TOKEN --env production

# OAuth
wrangler secret put CLIENT_ID --env production
wrangler secret put CLIENT_SECRET --env production

# Logger
wrangler secret put SLACK_CHANNEL --env production
wrangler secret put SLACK_TOKEN --env production
```

### Deploying

Deploy to staging:

```bash
npm run deploy:staging
```

Deploy to production:

```bash
npm run deploy:production
```

## R2 Bucket Setup

1. Create R2 buckets in Cloudflare dashboard:
    - `playground-static` (development)
    - `playground-static-staging` (staging)
    - `playground-static-production` (production)

2. Create R2 API token with read/write access

3. Configure GitHub secrets:
    - `CLOUDFLARE_ACCOUNT_ID`
    - `CLOUDFLARE_R2_ACCESS_KEY_ID`
    - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
    - `CLOUDFLARE_ZONE_ID`
    - `CLOUDFLARE_API_TOKEN`

4. Configure GitHub variables per environment:
    - `R2_BUCKET_NAME` (e.g., `playground-static-production`)
    - `CORS_PROXY_URL` (e.g., `https://cors-proxy.altolith.dev/?`)

## Architecture

```
                     ┌─────────────────────┐
                     │   Cloudflare CDN    │
                     └─────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌────────────────┐ ┌────────────┐ ┌────────────────┐
     │ Static Server  │ │ CORS Proxy │ │ Plugin Proxy   │
     │    Worker      │ │   Worker   │ │    Worker      │
     └────────────────┘ └────────────┘ └────────────────┘
              │                │                │
              ▼                ▼                ▼
     ┌────────────────┐ ┌────────────┐ ┌────────────────┐
     │   R2 Bucket    │ │  External  │ │  GitHub API    │
     │ (static files) │ │   URLs     │ │  WordPress.org │
     └────────────────┘ └────────────┘ └────────────────┘
```
