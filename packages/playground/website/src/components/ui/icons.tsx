/**
 * SVG Icons
 *
 * Replacements for @wordpress/icons
 */

import React from 'react';

interface IconProps {
	size?: number;
	className?: string;
}

export function CogIcon({ size = 24, className }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			width={size}
			height={size}
			className={className}
			fill="currentColor"
		>
			<path d="M12 8c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-1.2-9.6l-.5-.9c-.2-.3-.6-.5-.9-.5h-1.8c-.4 0-.7.2-.9.5l-.5.9c-.2.3-.2.7 0 1l.5.9c.2.3.2.7 0 1l-.5.9c-.2.3-.2.7 0 1l.5.9c.2.3.6.5.9.5h1.8c.4 0 .7-.2.9-.5l.5-.9c.2-.3.2-.7 0-1l-.5-.9c-.2-.3-.2-.7 0-1l.5-.9c.2-.3.2-.7 0-1zM12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z" />
		</svg>
	);
}

// WordPress dashicons cog/settings icon
export const cog = (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
		<path d="M12 8c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-1-11c-.6 0-1 .4-1 1v.3c0 .4-.2.8-.5 1-.3.2-.7.3-1.1.1l-.3-.1c-.5-.3-1.1-.1-1.4.4l-1 1.7c-.3.5-.1 1.1.4 1.4l.3.1c.3.2.5.6.5 1v.2c0 .4-.2.8-.5 1l-.3.1c-.5.3-.7.9-.4 1.4l1 1.7c.3.5.9.7 1.4.4l.3-.1c.3-.2.8-.1 1.1.1.3.2.5.6.5 1V19c0 .6.4 1 1 1h2c.6 0 1-.4 1-1v-.3c0-.4.2-.8.5-1 .3-.2.7-.3 1.1-.1l.3.1c.5.3 1.1.1 1.4-.4l1-1.7c.3-.5.1-1.1-.4-1.4l-.3-.1c-.3-.2-.5-.6-.5-1v-.2c0-.4.2-.8.5-1l.3-.1c.5-.3.7-.9.4-1.4l-1-1.7c-.3-.5-.9-.7-1.4-.4l-.3.1c-.3.2-.8.1-1.1-.1-.3-.2-.5-.6-.5-1V4c0-.6-.4-1-1-1h-2z" />
	</svg>
);

// WordPress close icon
export const close = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M12 13.06l3.712 3.712 1.061-1.06L13.061 12l3.712-3.712-1.06-1.06L12 10.938 8.288 7.227l-1.061 1.06L10.939 12l-3.712 3.712 1.06 1.061L12 13.061z" />
	</svg>
);

// WordPress page icon
export const page = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M7 5.5h10v13H7z" />
	</svg>
);

// WordPress details icon (list view)
export const details = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
	</svg>
);

// Folder icon
export const folder = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M18 5H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm.5 12c0 .3-.2.5-.5.5H6c-.3 0-.5-.2-.5-.5V7c0-.3.2-.5.5-.5h12c.3 0 .5.2.5.5v10z" />
	</svg>
);

// Layout icon
export const layout = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M18 5.5H6a.5.5 0 00-.5.5v3h13V6a.5.5 0 00-.5-.5zm.5 5H5.5v8c0 .3.2.5.5.5h12a.5.5 0 00.5-.5v-8zM6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
	</svg>
);

// Chevron left icon
export const chevronLeft = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M14.6 7l-1.2-1L8 12l5.4 6 1.2-1-4.6-5z" />
	</svg>
);

// Edit/pencil icon
export const edit = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M20.1 5.1L16.9 2 6.2 12.7l-1.3 4.4 4.5-1.3L20.1 5.1zM4 20.8h8v-1.5H4v1.5z" />
	</svg>
);

// More vertical icon (three dots)
export const moreVertical = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M13 19h-2v-2h2v2zm0-6h-2v-2h2v2zm0-6h-2V5h2v2z" />
	</svg>
);

// Download icon
export const download = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M18 11.3l-1-1.1-4 4.2V4h-1.5v10.4l-4-4.2-1 1.1 5.5 5.9 5-5.9zm-11 8.2V18h11v1.5H7z" />
	</svg>
);

// External link icon
export const external = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M18.2 17c0 .7-.6 1.2-1.2 1.2H7c-.7 0-1.2-.6-1.2-1.2V7c0-.7.6-1.2 1.2-1.2h3.2V4.2H7C5.5 4.2 4.2 5.5 4.2 7v10c0 1.5 1.2 2.8 2.8 2.8h10c1.5 0 2.8-1.2 2.8-2.8v-3.6h-1.5V17zM14.9 3v1.5h3.7l-6.4 6.4 1.1 1.1 6.4-6.4v3.7h1.5V3h-6.3z" />
	</svg>
);

// Info icon
export const info = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M12 3.2c-4.8 0-8.8 3.9-8.8 8.8 0 4.8 3.9 8.8 8.8 8.8 4.8 0 8.8-3.9 8.8-8.8 0-4.8-4-8.8-8.8-8.8zm0 16c-4 0-7.2-3.3-7.2-7.2C4.8 8 8 4.8 12 4.8s7.2 3.3 7.2 7.2c0 4-3.2 7.2-7.2 7.2zM13 11h-2v5h2v-5zm0-4h-2v2h2V7z" />
	</svg>
);

// Undo icon
export const undo = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M18.3 11.7c-.6-.6-1.4-.9-2.3-.9H6.7l2.9-3.3-1.1-1-4.5 5L8.5 16l1-1-2.7-2.7H16c.5 0 .9.2 1.3.5 1 1 1 3.4 1 4.5v.3h1.5v-.3c0-1.5 0-4.3-1.5-5.6z" />
	</svg>
);

// Cloud icon
export const cloud = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M17.3 10.1c0-2.5-2.1-4.4-4.8-4.4-2.2 0-4.1 1.4-4.6 3.3h-.4C5.8 9 4.5 10.2 4.5 11.8c0 1.5 1.3 2.8 2.8 2.8H17c1.3 0 2.5-1.1 2.5-2.5 0-1.1-.8-2-1.7-2h-.5z" />
	</svg>
);

// Upload icon
export const upload = (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
	>
		<path d="M18.5 15v3.5H5.5V15H4v3.5C4 19.3 4.7 20 5.5 20h13c.8 0 1.5-.7 1.5-1.5V15h-1.5zM12 4L7 9l1 1 3.3-3.3V15h1.5V6.7L16 10l1-1-5-5z" />
	</svg>
);

/**
 * Icon wrapper component for WordPress icon compatibility
 * Renders an icon element (React element or component) with consistent styling
 */
export function Icon({
	icon,
	size = 24,
	className,
}: {
	icon: React.ReactNode;
	size?: number;
	className?: string;
}) {
	if (!icon) return null;

	// If icon is a React element, clone it with size props
	if (React.isValidElement(icon)) {
		return React.cloneElement(icon as React.ReactElement<any>, {
			width: size,
			height: size,
			className,
		});
	}

	// Otherwise wrap it
	return (
		<span
			className={className}
			style={{ width: size, height: size, display: 'inline-flex' }}
		>
			{icon}
		</span>
	);
}
