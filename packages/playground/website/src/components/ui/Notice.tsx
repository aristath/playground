/**
 * Notice component using evergreen-ui Alert
 *
 * Drop-in replacement for @wordpress/components Notice
 */

import React from 'react';
import { Alert, Pane } from 'evergreen-ui';
import classNames from 'classnames';
import css from './Notice.module.css';

export interface NoticeProps {
	/** Notice status/type */
	status?: 'info' | 'success' | 'warning' | 'error';
	/** Whether the notice can be dismissed */
	isDismissible?: boolean;
	/** Callback when the notice is dismissed */
	onRemove?: () => void;
	/** Alternative callback for dismissal (WordPress compatibility) */
	onDismiss?: () => void;
	/** Actions to display in the notice */
	actions?: Array<{
		label: string;
		onClick: () => void;
		variant?: 'primary' | 'secondary';
	}>;
	/** Content of the notice */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
	/** Screen reader message (WordPress compatibility - not used visually) */
	spokenMessage?: string;
}

export function Notice({
	status = 'info',
	isDismissible = true,
	onRemove,
	onDismiss,
	actions,
	children,
	className,
	spokenMessage,
}: NoticeProps) {
	// Use onDismiss if provided, otherwise fall back to onRemove
	const handleRemove = onDismiss || onRemove;
	// Map WordPress status to evergreen intent
	const getIntent = () => {
		switch (status) {
			case 'success':
				return 'success';
			case 'warning':
				return 'warning';
			case 'error':
				return 'danger';
			default:
				return 'none';
		}
	};

	return (
		<Alert
			intent={getIntent()}
			hasIcon
			isRemoveable={isDismissible}
			onRemove={handleRemove}
			className={classNames(css.notice, className)}
			aria-label={spokenMessage}
		>
			<Pane>{children}</Pane>
			{actions && actions.length > 0 && (
				<Pane marginTop={8} display="flex" gap={8}>
					{actions.map((action, index) => (
						<button
							key={index}
							onClick={action.onClick}
							className={classNames(css.noticeAction, {
								[css.noticeActionPrimary]:
									action.variant === 'primary',
							})}
						>
							{action.label}
						</button>
					))}
				</Pane>
			)}
		</Alert>
	);
}

export default Notice;
