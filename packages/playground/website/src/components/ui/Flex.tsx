/**
 * Flex components using evergreen-ui
 *
 * Drop-in replacements for @wordpress/components Flex, FlexItem, VStack, HStack
 */

import React from 'react';
import { Pane } from 'evergreen-ui';
import classNames from 'classnames';

export interface FlexProps {
	/** Flex direction */
	direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
	/** Alignment on the cross axis */
	align?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
	/** Justify content on the main axis */
	justify?:
		| 'flex-start'
		| 'flex-end'
		| 'center'
		| 'space-between'
		| 'space-around'
		| 'space-evenly';
	/** Gap between items */
	gap?: number | string;
	/** Whether to wrap items */
	wrap?: boolean;
	/** Whether the flex container is expanded (WordPress compatibility) */
	expanded?: boolean;
	/** Children elements */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
	/** Inline styles */
	style?: React.CSSProperties;
}

export function Flex({
	direction = 'row',
	align = 'center',
	justify = 'flex-start',
	gap = 8,
	wrap = false,
	expanded = false,
	children,
	className,
	style,
}: FlexProps) {
	return (
		<Pane
			display="flex"
			flexDirection={direction}
			alignItems={align}
			justifyContent={justify}
			gap={gap}
			flexWrap={wrap ? 'wrap' : 'nowrap'}
			width={expanded ? '100%' : undefined}
			className={className}
			style={style}
		>
			{children}
		</Pane>
	);
}

export interface FlexItemProps {
	/** Whether this item should grow to fill available space */
	isBlock?: boolean;
	/** Children elements */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
	/** Inline styles */
	style?: React.CSSProperties;
}

export function FlexItem({
	isBlock = false,
	children,
	className,
	style,
}: FlexItemProps) {
	return (
		<Pane
			flexGrow={isBlock ? 1 : 0}
			flexShrink={isBlock ? 1 : 0}
			className={className}
			style={style}
		>
			{children}
		</Pane>
	);
}

/**
 * FlexBlock - A flex item that grows to fill available space
 * (WordPress compatibility)
 */
export function FlexBlock({
	children,
	className,
	style,
}: {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}) {
	return (
		<Pane flexGrow={1} flexShrink={1} className={className} style={style}>
			{children}
		</Pane>
	);
}

export interface StackProps {
	/** Gap between items */
	spacing?: number | string;
	/** Justify content on the main axis */
	justify?:
		| 'flex-start'
		| 'flex-end'
		| 'center'
		| 'space-between'
		| 'space-around'
		| 'space-evenly';
	/** Alignment on the cross axis (HStack) */
	alignment?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
	/** Children elements */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
	/** Inline styles */
	style?: React.CSSProperties;
	/** Element type to render as (WordPress compatibility) */
	as?: keyof JSX.IntrinsicElements;
}

/**
 * Vertical stack (column layout)
 */
export function VStack({
	spacing = 8,
	children,
	className,
	style,
}: StackProps) {
	return (
		<Pane
			display="flex"
			flexDirection="column"
			gap={spacing}
			className={className}
			style={style}
		>
			{children}
		</Pane>
	);
}

/**
 * Horizontal stack (row layout)
 */
export function HStack({
	spacing = 8,
	justify = 'flex-start',
	alignment = 'center',
	children,
	className,
	style,
	as,
}: StackProps) {
	return (
		<Pane
			is={as}
			display="flex"
			flexDirection="row"
			alignItems={alignment}
			justifyContent={justify}
			gap={spacing}
			className={className}
			style={style}
		>
			{children}
		</Pane>
	);
}

// Aliases for WordPress experimental naming
export const __experimentalVStack = VStack;
export const __experimentalHStack = HStack;

export default Flex;
