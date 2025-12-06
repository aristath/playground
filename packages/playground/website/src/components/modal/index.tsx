import React from 'react';
import { Modal as EvergreenModal } from '../ui';
import classNames from 'classnames';
import css from './style.module.css';

interface ModalProps {
	title?: string;
	isOpen?: boolean;
	onRequestClose?: () => void;
	children: React.ReactNode;
	className?: string;
	small?: boolean;
	isDismissable?: boolean;
}

export function Modal({
	small,
	className,
	children,
	title,
	onRequestClose,
	...rest
}: ModalProps) {
	const modalClass = classNames(
		css.modal,
		{
			[css.modalSmall]: small,
		},
		className
	);

	return (
		<EvergreenModal
			title={title}
			onRequestClose={onRequestClose}
			className={modalClass}
			small={small}
			{...rest}
		>
			{children}
		</EvergreenModal>
	);
}
