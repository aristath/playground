/**
 * Menu components using evergreen-ui
 *
 * Drop-in replacements for @wordpress/components MenuItem and Dropdown
 */

import React from 'react';
import {
	Menu as EvergreenMenu,
	Popover,
	Position,
	Button,
	Pane,
} from 'evergreen-ui';
import classNames from 'classnames';
import css from './Menu.module.css';

export interface MenuItemProps {
	/** Click handler */
	onClick?: () => void;
	/** Icon to display before the label */
	icon?: React.ReactNode;
	/** Whether the item is destructive (red) */
	isDestructive?: boolean;
	/** Whether the item is disabled */
	disabled?: boolean;
	/** Keyboard shortcut to display */
	shortcut?: string;
	/** Additional info text */
	info?: string;
	/** Children elements (label) */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
	/** Role attribute for accessibility */
	role?: string;
}

export function MenuItem({
	onClick,
	icon,
	isDestructive = false,
	disabled = false,
	shortcut,
	info,
	children,
	className,
	role = 'menuitem',
}: MenuItemProps) {
	return (
		<EvergreenMenu.Item
			onSelect={onClick}
			icon={icon as any}
			intent={isDestructive ? 'danger' : 'none'}
			disabled={disabled}
			secondaryText={shortcut || info}
			className={classNames(css.menuItem, className)}
		>
			{children}
		</EvergreenMenu.Item>
	);
}

export interface DropdownMenuProps {
	/** The element that triggers the dropdown */
	renderToggle: (props: {
		isOpen: boolean;
		onToggle: () => void;
	}) => React.ReactNode;
	/** The content of the dropdown menu (WordPress compatibility) */
	children?: React.ReactNode;
	/** Render content function (WordPress compatibility) */
	renderContent?: (props: { onClose: () => void }) => React.ReactNode;
	/** Position of the dropdown */
	position?:
		| 'top'
		| 'top-left'
		| 'top-right'
		| 'bottom'
		| 'bottom-left'
		| 'bottom-right'
		| 'left'
		| 'right';
	/** Additional CSS class name */
	className?: string;
	/** WordPress popoverProps compatibility (ignored, placement used from here) */
	popoverProps?: { placement?: string };
	/** WordPress contentClassName compatibility (ignored) */
	contentClassName?: string;
}

export function DropdownMenu({
	renderToggle,
	children,
	renderContent,
	position = 'bottom-left',
	className,
	popoverProps,
	contentClassName,
}: DropdownMenuProps) {
	const [isOpen, setIsOpen] = React.useState(false);

	// Map popoverProps.placement to our position if provided
	const effectivePosition = popoverProps?.placement
		? (popoverProps.placement
				.replace('-start', '-left')
				.replace('-end', '-right') as any)
		: position;

	// Map position string to evergreen Position
	const getPosition = () => {
		switch (effectivePosition) {
			case 'top':
				return Position.TOP;
			case 'top-left':
				return Position.TOP_LEFT;
			case 'top-right':
				return Position.TOP_RIGHT;
			case 'bottom':
				return Position.BOTTOM;
			case 'bottom-left':
				return Position.BOTTOM_LEFT;
			case 'bottom-right':
				return Position.BOTTOM_RIGHT;
			case 'left':
				return Position.LEFT;
			case 'right':
				return Position.RIGHT;
			default:
				return Position.BOTTOM_LEFT;
		}
	};

	const onClose = () => setIsOpen(false);

	// Determine content - either renderContent or children
	const content = renderContent ? (
		<Pane padding={0}>{renderContent({ onClose })}</Pane>
	) : (
		<EvergreenMenu>
			<EvergreenMenu.Group>{children}</EvergreenMenu.Group>
		</EvergreenMenu>
	);

	return (
		<Popover
			position={getPosition()}
			isShown={isOpen}
			onOpen={() => setIsOpen(true)}
			onClose={onClose}
			content={content}
		>
			{
				renderToggle({
					isOpen,
					onToggle: () => setIsOpen(!isOpen),
				}) as React.ReactElement
			}
		</Popover>
	);
}

// Alias for backwards compatibility
export const Dropdown = DropdownMenu;

export default MenuItem;
