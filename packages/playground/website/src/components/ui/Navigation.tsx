/**
 * Navigation components
 *
 * Drop-in replacements for @wordpress/components navigation components:
 * NavigableMenu, MenuGroup, ItemGroup, Item
 */

import React from 'react';
import { Pane, Heading as EvergreenHeading } from 'evergreen-ui';
import classNames from 'classnames';

export interface NavigableMenuProps {
	/** Children elements */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
	/** Role attribute */
	role?: string;
	/** Aria orientation */
	'aria-orientation'?: 'horizontal' | 'vertical';
}

/**
 * NavigableMenu - A simple wrapper that replaces WordPress NavigableMenu
 */
export function NavigableMenu({
	children,
	className,
	role,
	...props
}: NavigableMenuProps) {
	return (
		<Pane
			is="div"
			className={className}
			role={role || undefined}
			{...props}
		>
			{children}
		</Pane>
	);
}

export interface MenuGroupProps {
	/** Children elements */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
}

/**
 * MenuGroup - A simple wrapper for grouping menu items
 */
export function MenuGroup({ children, className }: MenuGroupProps) {
	return (
		<Pane is="div" className={className} role="group">
			{children}
		</Pane>
	);
}

export interface ItemGroupProps {
	/** Children elements */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
}

/**
 * ItemGroup - A simple wrapper for grouping items
 * (WordPress __experimentalItemGroup replacement)
 */
export function ItemGroup({ children, className }: ItemGroupProps) {
	return (
		<Pane is="div" className={className}>
			{children}
		</Pane>
	);
}

export interface ItemProps {
	/** Element type */
	as?: 'a' | 'button' | 'div';
	/** Children elements */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
	/** Href for anchor elements */
	href?: string;
	/** Target for anchor elements */
	target?: string;
	/** Rel for anchor elements */
	rel?: string;
	/** Click handler */
	onClick?: () => void;
}

/**
 * Item - A generic item component
 * (WordPress __experimentalItem replacement)
 */
export function Item({
	as = 'div',
	children,
	className,
	href,
	target,
	rel,
	onClick,
}: ItemProps) {
	const Component = as;
	return (
		<Component
			className={className}
			href={href}
			target={target}
			rel={rel}
			onClick={onClick}
		>
			{children}
		</Component>
	);
}

export interface SidebarHeadingProps {
	/** Heading level (1-6) */
	level?: 1 | 2 | 3 | 4 | 5 | 6;
	/** Children elements */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
}

/**
 * Heading wrapper for WordPress compatibility
 * (WordPress __experimentalHeading replacement)
 */
export function SidebarHeading({
	level = 2,
	children,
	className,
}: SidebarHeadingProps) {
	// Map level to evergreen heading size (larger numbers = smaller text)
	const sizeMap: Record<
		number,
		100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900
	> = {
		1: 700,
		2: 500,
		3: 400,
		4: 300,
		5: 200,
		6: 100,
	};
	return (
		<EvergreenHeading size={sizeMap[level]} className={className}>
			{children}
		</EvergreenHeading>
	);
}

export interface SidebarMenuItemProps {
	/** Click handler */
	onClick?: () => void;
	/** Whether the item is selected */
	isSelected?: boolean;
	/** Additional CSS class name */
	className?: string;
	/** Role attribute */
	role?: string;
	/** Title/tooltip */
	title?: string;
	/** Aria current attribute */
	'aria-current'?:
		| 'page'
		| 'step'
		| 'location'
		| 'date'
		| 'time'
		| 'true'
		| 'false';
	/** Children elements */
	children: React.ReactNode;
}

/**
 * SidebarMenuItem - A menu item for sidebars with selection state
 * (WordPress MenuItem replacement for sidebar context)
 */
export function SidebarMenuItem({
	onClick,
	isSelected = false,
	className,
	role,
	title,
	children,
	...props
}: SidebarMenuItemProps) {
	return (
		<Pane
			is="button"
			onClick={onClick}
			className={className}
			role={role || 'menuitem'}
			title={title}
			aria-selected={isSelected}
			cursor="pointer"
			background="transparent"
			border="none"
			width="100%"
			textAlign="left"
			padding={0}
			{...props}
		>
			{children}
		</Pane>
	);
}

// WordPress experimental aliases
export const __experimentalItemGroup = ItemGroup;
export const __experimentalItem = Item;
export const __experimentalHeading = SidebarHeading;
