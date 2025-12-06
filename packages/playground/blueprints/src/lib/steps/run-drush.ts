import type { PHPResponse, UniversalPHP } from '@php-wasm/universal';
import type { StepHandler } from '.';
import { joinPaths, phpVar } from '@php-wasm/util';
import type { FileReference } from '../v1/resources';
import { logger } from '@php-wasm/logger';

export const defaultDrushPath = '/tmp/drush.phar';
export const defaultDrushResource: FileReference = {
	resource: 'url',
	/**
	 * Drush PHAR file for executing Drush commands.
	 * Drush 10.x is compatible with Drupal 9.x.
	 * @TODO: Host a minified drush.phar on playground.wordpress.net
	 */
	url: 'https://github.com/drush-ops/drush/releases/download/10.6.2/drush.phar',
};

export const assertDrush = async (
	playground: UniversalPHP,
	drushPath: string = defaultDrushPath
) => {
	if (!(await playground.fileExists(drushPath))) {
		throw new Error(`drush.phar not found at ${drushPath}.
			You can enable Drush support by adding "drush" to the list of extra libraries in your blueprint as follows:
			{
				"extraLibraries": [ "drush" ]
			}
			Read more about it in the documentation.`);
	}
};

/**
 * @inheritDoc runDrush
 * @hasRunnableExample
 * @example
 *
 * <code>
 * {
 * 		"step": "runDrush",
 * 		"command": "drush status"
 * }
 * </code>
 *
 * @example
 *
 * <code>
 * {
 * 		"step": "runDrush",
 * 		"command": "drush pm:enable views -y"
 * }
 * </code>
 */
export interface RunDrushStep {
	/** The step identifier. */
	step: 'runDrush';
	/** The Drush command to run. */
	command: string | string[];
	/** drush.phar path */
	drushPath?: string;
}

/**
 * Runs Drush commands for Drupal.
 * Similar to WP-CLI for WordPress, Drush is the command-line shell
 * and scripting interface for Drupal.
 */
export const runDrush: StepHandler<RunDrushStep, Promise<PHPResponse>> = async (
	playground,
	{ command, drushPath = defaultDrushPath }
) => {
	await assertDrush(playground, drushPath);

	let args: string[];
	if (typeof command === 'string') {
		command = command.trim();
		args = splitShellCommand(command);
	} else {
		args = command;
	}

	const cmd = args.shift();
	if (cmd !== 'drush') {
		throw new Error(`The first argument must be "drush".`);
	}

	const documentRoot = await playground.documentRoot;

	await playground.writeFile('/tmp/stdout', '');
	await playground.writeFile('/tmp/stderr', '');
	await playground.writeFile(
		joinPaths(documentRoot, 'run-drush.php'),
		`<?php
		// Set up the environment to emulate a shell script call.

		// Set SHELL_PIPE to 0 to ensure Drush formats
		// the output as ASCII tables.
		putenv('SHELL_PIPE=0');

		// Set the argv global.
		$GLOBALS['argv'] = array_merge([
		  ${phpVar(drushPath)},
		  "--root=${documentRoot}"
		], ${phpVar(args)});

		// Provide stdin, stdout, stderr streams outside of
		// the CLI SAPI.
		define('STDIN', fopen('php://stdin', 'rb'));
		define('STDOUT', fopen('php://stdout', 'wb'));
		define('STDERR', fopen('php://stderr', 'wb'));

		require(${phpVar(drushPath)});
		`
	);

	const result = await playground.run({
		scriptPath: joinPaths(documentRoot, 'run-drush.php'),
	});

	if (result.errors) {
		logger.error('Drush command failed:', result.errors);
		throw new Error(result.errors);
	}

	return result;
};

/**
 * Naive shell command parser.
 * Ensures that commands like `drush config:set system.site name "My Site"` are split
 * into `['drush', 'config:set', 'system.site', 'name', 'My Site']` instead of
 * `['drush', 'config:set', 'system.site', 'name', 'My', 'Site']`.
 */
export function splitShellCommand(command: string) {
	const MODE_NORMAL = 0;
	const MODE_IN_QUOTE = 1;

	let mode = MODE_NORMAL;
	let quote = '';

	const parts: string[] = [];
	let currentPart = '';
	for (let i = 0; i < command.length; i++) {
		const char = command[i];
		if (mode === MODE_NORMAL) {
			if (char === '"' || char === "'") {
				mode = MODE_IN_QUOTE;
				quote = char;
			} else if (char.match(/\s/)) {
				if (currentPart) {
					parts.push(currentPart);
				}
				currentPart = '';
			} else {
				currentPart += char;
			}
		} else if (mode === MODE_IN_QUOTE) {
			if (char === '\\') {
				i++;
				currentPart += command[i];
			} else if (char === quote) {
				mode = MODE_NORMAL;
				quote = '';
			} else {
				currentPart += char;
			}
		}
	}
	if (currentPart) {
		parts.push(currentPart);
	}
	return parts;
}
