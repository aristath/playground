# WordPress Playground Infrastructure Transformation Plan

## Overview

This plan covers four major initiatives to transform WordPress Playground:

1. **Static File Hosting**: Migrate to Cloudflare R2 + Worker
2. **CORS Proxy**: Convert PHP proxy to JavaScript Cloudflare Worker
3. **UI Rewrite**: Complete rewrite using evergreen-ui
4. **Drupal 9 Support**: Full CMS parity with WordPress

---

## 1. Cloudflare R2 + Worker Static Hosting

### Goal

Serve static files from Cloudflare R2 bucket via a simple Cloudflare Worker.

### New Files to Create

```
cloudflare-workers/
  static-server/
    src/index.ts           # Worker entry point
    wrangler.toml          # Cloudflare config
    package.json
```

### Worker Implementation (`static-server/src/index.ts`)

Basic file serving from R2:

- Serve files from R2 bucket
- Set appropriate MIME types
- Handle redirects (e.g., `/docs` → documentation site, `/builder` → `/builder/builder.html`)
- Cache immutable assets (hashed filenames) forever
- No-cache for entry points (`index.html`, `remote.html`)
- Support range requests for large WASM files

### R2 Bucket Structure

Mirror the existing build output at `dist/packages/playground/wasm-wordpress-net`:

```
/index.html
/remote.html
/sw.js
/assets/*.js, *.css, *.wasm, *.zip
/client/index.js
/demos/*.html
/builder/builder.html
```

### GitHub Actions Workflow

New file: `.github/workflows/deploy-website-r2.yml`

- Build using existing `npx nx build playground-website`
- Upload to R2 using rclone
- Purge Cloudflare cache after deploy

### Required Secrets

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_API_TOKEN`

### PHP Endpoints → Cloudflare Workers

Three PHP endpoints will be converted to Cloudflare Workers:

#### 1. Plugin Proxy Worker (`/plugin-proxy`)

- **Purpose**: Proxy requests to GitHub API for plugin/theme fetching
- **Secret**: `GITHUB_TOKEN` (stored as Worker secret)
- **Logic**: Simple fetch proxy that adds Authorization header

#### 2. OAuth Worker (`/oauth.php`)

- **Purpose**: Handle GitHub OAuth authentication flow
- **Secrets**: `CLIENT_ID`, `CLIENT_SECRET` (stored as Worker secrets)
- **Logic**: OAuth token exchange with GitHub

#### 3. Logger Worker (`/logger.php`)

- **Purpose**: Send logs/errors to Slack
- **Secrets**: `SLACK_CHANNEL`, `SLACK_TOKEN` (stored as Worker secrets)
- **Logic**: POST to Slack webhook API

**Directory Structure**:

```
cloudflare-workers/
  static-server/          # R2 file server
  cors-proxy/             # CORS proxy
  plugin-proxy/           # GitHub API proxy
  oauth/                  # GitHub OAuth handler
  logger/                 # Slack logger
```

All Workers share a common wrangler setup and can be deployed together or separately.

---

## 2. JavaScript CORS Proxy (Cloudflare Worker)

### Goal

Replace PHP CORS proxy with JavaScript Cloudflare Worker using Cloudflare's native security features.

### New Package Structure

```
packages/playground/cors-proxy-worker/
  src/
    index.ts              # Main Worker entry
    cors.ts               # CORS header handling
    headers.ts            # Header filtering
    url-utils.ts          # URL validation
    ip-utils.ts           # Private IP detection
    redirect.ts           # Redirect URL rewriting
  wrangler.toml
  package.json
  project.json            # Nx config
  tsconfig.json
```

### Core Functionality to Port

From `packages/playground/php-cors-proxy/cors-proxy.php`:

- URL extraction from query string (`?https://target.com`)
- Method validation (GET, POST, OPTIONS only)
- Size limits (1MB request, 100MB response)
- Header filtering (remove Cookie, Host; opt-in for Authorization)
- Redirect URL rewriting through proxy
- CORS headers for whitelisted origins

### Security (Cloudflare Native)

Instead of PHP token-bucket rate limiting:

- **Cloudflare Rate Limiting Rules**: 100 req/min per IP
- **WAF Rules**: Block private IP targets, non-HTTP protocols
- **Bot Fight Mode**: Built-in bot protection

### Frontend Changes

Update virtual module URL in:

- `packages/playground/website/vite.config.ts`
- `packages/playground/remote/vite.config.ts`

Production URL stays: `https://cors-proxy.altolith.dev/?`
Dev URL changes to: `http://127.0.0.1:5263/?` (Wrangler dev server)

No changes needed to `fetch-with-cors-proxy.ts` - URL format unchanged.

---

## 3. Evergreen UI Rewrite

### Goal

Complete rewrite of React UI using evergreen-ui, replacing all @wordpress/components.

### Current Dependencies to Remove

- `@wordpress/components`
- `@wordpress/compose`
- `@wordpress/icons`
- `@wordpress/block-editor`

### New Dependencies

- `evergreen-ui` (v7.x)

### Component Migration Map

| Current               | Evergreen Replacement         |
| --------------------- | ----------------------------- |
| `Modal` (@wordpress)  | `Dialog` / `SideSheet`        |
| `SelectControl`       | `SelectField`                 |
| `CheckboxControl`     | `Checkbox`                    |
| `Button` (@wordpress) | `Button`                      |
| `Dropdown`            | `Popover` + `Menu`            |
| `Spinner`             | `Spinner`                     |
| `Icon`                | evergreen icons or inline SVG |
| `VStack`              | `Pane` with flex column       |
| `ResizableBox`        | Keep `react-resizable-panels` |

### New Directory Structure

```
packages/playground/website/src/
  components/
    ui/                    # NEW: Shared evergreen wrappers
      Button.tsx
      Modal.tsx
      Select.tsx
      FormField.tsx
    layout/                # Refactored layout components
    site-manager/          # Migrated with evergreen
    browser-chrome/        # Migrated with evergreen
    ...
  lib/
    theme/
      evergreen-theme.ts   # NEW: Custom theme config
```

### Key Files to Rewrite

1. `packages/playground/website/src/components/modal/index.tsx`
2. `packages/playground/website/src/components/site-manager/site-settings-form/unconnected-site-settings-form.tsx`
3. `packages/playground/website/src/components/browser-chrome/index.tsx`
4. `packages/playground/website/src/components/site-manager/index.tsx`
5. All components in `packages/playground/website/src/components/`

### Theme Setup

Create custom evergreen theme to match Playground branding:

- Color palette
- Typography
- Spacing
- Component variants

---

## 4. Drupal 9 Support (Full Parity)

### Goal

Run Drupal 9 in the browser with the same features as WordPress.

### New Packages

```
packages/playground/
  drupal/                          # NEW: Drupal boot logic
    src/
      boot.ts                      # bootDrupal() function
      index.ts                     # Public exports
      settings-php.ts              # Drupal settings.php management
      rewrite-rules.ts             # Drupal URL rewrite rules
      version-detect.ts            # Drupal version detection
    project.json
    package.json

  drupal-builds/                   # NEW: Drupal distributions
    src/
      index.ts
      drupal/
        get-drupal-module.ts
        get-drupal-module-details.ts
        drupal-versions.json
    public/
      drupal-9.5.zip              # Drupal 9.5 distribution
    project.json
    package.json
```

### Drupal Boot Logic

Mirror `packages/playground/wordpress/src/boot.ts`:

1. Create PHP runtime
2. Mount Drupal files from zip
3. Configure `sites/default/settings.php`
4. Setup SQLite database (Drupal has built-in SQLite driver)
5. Run Drupal installer if needed

### Blueprint Steps for Drupal

New blueprint steps in `packages/playground/blueprints/src/lib/steps/`:

- `installDrupalModule.ts`
- `enableDrupalModule.ts`
- `installDrupalTheme.ts`
- `enableDrupalTheme.ts`
- `runDrush.ts`

### UI Changes for CMS Selection

Extend `SiteMetadata` interface:

```typescript
interface SiteMetadata {
	// ... existing fields
	cmsType: 'wordpress' | 'drupal';
}
```

Add CMS selector to site settings form:

- Dropdown to choose WordPress or Drupal
- Show appropriate version selector based on CMS choice
- Conditional form fields

### Boot Client Changes

Modify `packages/playground/website/src/lib/state/redux/boot-site-client.ts`:

- Check `cmsType` from site metadata
- Call `bootWordPress()` or `bootDrupal()` accordingly

---

## Implementation Order

### Phase 1: Infrastructure (START HERE)

**Step 1.1: Cloudflare R2 Static Server Worker**

1. Create `cloudflare-workers/static-server/` directory structure
2. Implement Worker with R2 binding for file serving
3. Add MIME type handling, redirects, caching headers
4. Create `wrangler.toml` with R2 bucket config
5. Test locally with `wrangler dev`

**Step 1.2: R2 Deployment Pipeline**

1. Create `.github/workflows/deploy-website-r2.yml`
2. Set up rclone for R2 sync
3. Configure GitHub secrets for Cloudflare credentials
4. Test staging deployment

**Step 1.3: CORS Proxy Worker**

1. Create `cloudflare-workers/cors-proxy/` package
2. Port PHP logic to TypeScript (URL validation, header filtering, redirects)
3. Configure Cloudflare security rules (rate limiting, WAF)
4. Update vite.config.ts files to use new Worker URL
5. Test with Playground frontend

**Step 1.4: PHP Endpoint Workers**

1. Create `cloudflare-workers/plugin-proxy/` - GitHub API proxy
    - Port plugin-proxy.php logic
    - Add `GITHUB_TOKEN` as Worker secret
2. Create `cloudflare-workers/oauth/` - GitHub OAuth handler
    - Port oauth.php logic
    - Add `CLIENT_ID`, `CLIENT_SECRET` as Worker secrets
3. Create `cloudflare-workers/logger/` - Slack logger
    - Port logger.php logic
    - Add `SLACK_CHANNEL`, `SLACK_TOKEN` as Worker secrets
4. Update frontend to use new Worker URLs

**Step 1.5: Production Migration**

1. Deploy all Workers to production (static-server, cors-proxy, plugin-proxy, oauth, logger)
2. Update DNS records
3. Monitor and validate
4. Remove old PHP deployment files once stable

### Phase 2: Drupal Support (After Infrastructure)

1. **drupal package** - Boot logic
2. **drupal-builds package** - Drupal distributions
3. **Blueprint steps** - Drupal-specific steps
4. **UI integration** - CMS selection

### Phase 3: UI Rewrite (After Drupal)

1. **Evergreen theme** - Set up theme
2. **UI primitives** - Button, Modal, Select wrappers
3. **Component migration** - Rewrite all components
4. **Cleanup** - Remove @wordpress dependencies

---

## Critical Files Summary

### To Modify

- `packages/playground/website/vite.config.ts` - CORS proxy URL
- `packages/playground/remote/vite.config.ts` - CORS proxy URL
- `packages/playground/website/src/lib/state/redux/slice-sites.ts` - Add cmsType
- `packages/playground/website/src/lib/state/redux/boot-site-client.ts` - CMS boot routing
- `packages/playground/blueprints/src/lib/steps/index.ts` - Register Drupal steps

### To Create

- `cloudflare-workers/static-server/` - R2 file server
- `cloudflare-workers/cors-proxy/` - CORS proxy
- `cloudflare-workers/plugin-proxy/` - GitHub API proxy
- `cloudflare-workers/oauth/` - GitHub OAuth handler
- `cloudflare-workers/logger/` - Slack logger
- `packages/playground/drupal/` - Drupal boot logic
- `packages/playground/drupal-builds/` - Drupal distributions
- `.github/workflows/deploy-website-r2.yml` - R2 deployment

### To Rewrite (UI)

- All files in `packages/playground/website/src/components/`

### To Eventually Remove

- `packages/playground/php-cors-proxy/` - After Worker is stable
- `packages/playground/website-deployment/` - PHP deployment files
- `@wordpress/components`, `@wordpress/compose`, `@wordpress/icons` from dependencies
