import type { RewriteRule } from '@php-wasm/universal';

/**
 * Drupal rewrite rules for clean URLs.
 *
 * Drupal uses a similar rewrite pattern to WordPress - all requests
 * that don't match static files are routed to index.php which handles
 * the routing internally.
 */
export const drupalRewriteRules: RewriteRule[] = [
	// Pass through requests for actual files (css, js, images, etc)
	{
		match: /\.(css|js|gif|jpg|jpeg|png|svg|ico|woff|woff2|ttf|eot|map)$/i,
		replacement: '$0',
	},
	// Pass through requests for PHP files directly
	{
		match: /\.php$/i,
		replacement: '$0',
	},
	// Route everything else through index.php (clean URLs)
	{
		match: /^\/(.*)$/,
		replacement: '/index.php?q=$1',
	},
];
