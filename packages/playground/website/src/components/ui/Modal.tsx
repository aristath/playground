/**
 * Modal component using evergreen-ui Dialog
 *
 * This component provides a drop-in replacement for the WordPress Modal component
 * while using evergreen-ui's Dialog under the hood.
 */

import React from 'react';
import { Dialog, Pane, Heading, IconButton, CrossIcon } from 'evergreen-ui';
import classNames from 'classnames';
import css from './Modal.module.css';

export interface ModalProps {
	/** Modal title displayed in the header */
	title?: string | React.ReactNode;
	/** Whether the modal is open */
	isOpen?: boolean;
	/** Callback when the modal should close */
	onRequestClose?: () => void;
	/** Content to render inside the modal */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
	/** Whether to render a smaller modal */
	small?: boolean;
	/** Whether to show the close button (WordPress: isDismissible) */
	isDismissable?: boolean;
	/** WordPress compatibility alias for isDismissable */
	isDismissible?: boolean;
	/** Custom styles */
	style?: React.CSSProperties;
	/** Content label for accessibility (WordPress compatibility - ignored) */
	contentLabel?: string;
	/** Whether to close on click outside (WordPress compatibility) */
	shouldCloseOnClickOutside?: boolean;
	/** Whether modal is full screen */
	isFullScreen?: boolean;
}

export function Modal({
	title,
	isOpen = true,
	onRequestClose,
	children,
	className,
	small = false,
	isDismissable = true,
	isDismissible,
	style,
	contentLabel,
	shouldCloseOnClickOutside = true,
	isFullScreen = false,
}: ModalProps) {
	// WordPress uses isDismissible, we use isDismissable
	const canDismiss =
		isDismissible !== undefined ? isDismissible : isDismissable;
	const modalClass = classNames(
		css.modal,
		{
			[css.modalSmall]: small,
		},
		className
	);

	return (
		<Dialog
			isShown={isOpen}
			onCloseComplete={onRequestClose}
			hasHeader={false}
			hasFooter={false}
			shouldCloseOnOverlayClick={canDismiss && shouldCloseOnClickOutside}
			shouldCloseOnEscapePress={canDismiss}
			containerProps={{
				className: modalClass,
				style,
			}}
			width={isFullScreen ? '100vw' : small ? 350 : 600}
		>
			{title && (
				<Pane
					display="flex"
					alignItems="center"
					justifyContent="space-between"
					padding={16}
					borderBottom="1px solid #ddd"
				>
					<Heading size={500} fontWeight={300}>
						{title}
					</Heading>
					{canDismiss && onRequestClose && (
						<IconButton
							icon={CrossIcon}
							appearance="minimal"
							onClick={onRequestClose}
							aria-label="Close"
						/>
					)}
				</Pane>
			)}
			<Pane padding={16}>{children}</Pane>
		</Dialog>
	);
}

export default Modal;
