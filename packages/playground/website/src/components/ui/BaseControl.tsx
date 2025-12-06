/**
 * BaseControl component using evergreen-ui
 *
 * Drop-in replacement for @wordpress/components BaseControl
 */

import React from 'react';
import { FormField, Pane } from 'evergreen-ui';
import classNames from 'classnames';
import css from './FormControls.module.css';

export interface BaseControlProps {
	/** Label for the control */
	label?: string;
	/** ID for the control (for label association) */
	id?: string;
	/** Help text displayed below the control */
	help?: string;
	/** Children elements */
	children: React.ReactNode;
	/** Additional CSS class name */
	className?: string;
}

export function BaseControl({
	label,
	id,
	help,
	children,
	className,
}: BaseControlProps) {
	if (!label && !help) {
		return <Pane className={className}>{children}</Pane>;
	}

	return (
		<FormField
			label={label}
			labelFor={id}
			description={help}
			className={classNames(css.formField, className)}
		>
			{children}
		</FormField>
	);
}

export default BaseControl;
