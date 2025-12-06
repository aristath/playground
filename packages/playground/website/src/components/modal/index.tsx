import React from 'react';
import { Modal as EvergreenModal, ModalProps as BaseModalProps } from '../ui';
import classNames from 'classnames';
import css from './style.module.css';

interface ModalProps extends Omit<BaseModalProps, 'className'> {
	className?: string;
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
