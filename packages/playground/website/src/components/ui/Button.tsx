/**
 * Button component using evergreen-ui
 *
 * This component provides a drop-in replacement for both the custom Button
 * and @wordpress/components Button while using evergreen-ui under the hood.
 */

import React from 'react';
import {
	Button as EvergreenButton,
	IconButton as EvergreenIconButton,
	Spinner,
} from 'evergreen-ui';
import classNames from 'classnames';
import css from './Button.module.css';

export interface ButtonProps {
	/** Button variant */
	variant?: 'primary' | 'secondary' | 'default' | 'browser-chrome' | 'link';
	/** Button size */
	size?: 'small' | 'medium' | 'large';
	/** Whether the button is in a loading/busy state */
	isBusy?: boolean;
	/** Whether the button is destructive (red) */
	isDestructive?: boolean;
	/** Icon to show (renders as IconButton if only icon, no children) */
	icon?: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
	/** Click handler */
	onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
	/** Children */
	children?: React.ReactNode;
	/** Whether disabled */
	disabled?: boolean;
	/** Button type */
	type?: 'button' | 'submit' | 'reset';
	/** Aria label */
	'aria-label'?: string;
	/** Aria expanded */
	'aria-expanded'?: boolean;
	/** Aria pressed */
	'aria-pressed'?: boolean;
	/** Style */
	style?: React.CSSProperties;
	/** Text prop (WordPress compatibility) */
	text?: string;
	/** isSmall prop (WordPress compatibility) */
	isSmall?: boolean;
}

export function Button({
	variant = 'default',
	size = 'medium',
	isBusy = false,
	isDestructive = false,
	icon,
	children,
	className,
	disabled,
	type = 'button',
	text,
	isSmall,
	...rest
}: ButtonProps) {
	// Handle WordPress isSmall prop
	const effectiveSize = isSmall ? 'small' : size;

	const buttonClass = classNames(
		css.button,
		{
			[css.isPrimary]: variant === 'primary',
			[css.isSecondary]: variant === 'secondary',
			[css.isBrowserChrome]: variant === 'browser-chrome',
			[css.isLink]: variant === 'link',
			[css.isSmall]: effectiveSize === 'small',
			[css.isLarge]: effectiveSize === 'large',
			[css.isDestructive]: isDestructive,
		},
		className
	);

	// Map variant to evergreen appearance
	const getAppearance = ():
		| 'default'
		| 'minimal'
		| 'primary'
		| 'destructive' => {
		switch (variant) {
			case 'primary':
				return 'primary';
			case 'link':
				return 'minimal';
			default:
				return 'default';
		}
	};

	// Map size to evergreen height
	const getHeight = () => {
		switch (effectiveSize) {
			case 'small':
				return 24;
			case 'large':
				return 40;
			default:
				return 32;
		}
	};

	// Use text prop if no children
	const content = children || text;

	// If only icon and no content, render as IconButton
	if (icon && !content) {
		return (
			<EvergreenIconButton
				icon={icon as any}
				appearance={getAppearance()}
				intent={isDestructive ? 'danger' : 'none'}
				height={getHeight()}
				disabled={disabled || isBusy}
				className={buttonClass}
				type={type}
				{...rest}
			/>
		);
	}

	return (
		<EvergreenButton
			appearance={getAppearance()}
			intent={isDestructive ? 'danger' : 'none'}
			height={getHeight()}
			disabled={disabled || isBusy}
			iconBefore={icon as any}
			className={buttonClass}
			type={type}
			{...rest}
		>
			{isBusy ? <Spinner size={16} /> : null}
			{content}
		</EvergreenButton>
	);
}

export default Button;
