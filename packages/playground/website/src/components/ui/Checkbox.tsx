/**
 * Checkbox component using evergreen-ui
 *
 * Drop-in replacement for @wordpress/components CheckboxControl
 */

import React from 'react';
import { Checkbox as EvergreenCheckbox, FormField, Pane } from 'evergreen-ui';
import classNames from 'classnames';
import css from './FormControls.module.css';

export interface CheckboxProps {
	/** Label for the checkbox */
	label?: string;
	/** Whether the checkbox is checked */
	checked?: boolean;
	/** Change handler */
	onChange: (checked: boolean) => void;
	/** Help text displayed below the checkbox */
	help?: string;
	/** Whether the checkbox is disabled */
	disabled?: boolean;
	/** Additional CSS class name */
	className?: string;
	/** Checkbox name attribute */
	name?: string;
	/** Value attribute (WordPress compatibility) */
	value?: string;
	/** onBlur handler (WordPress compatibility) */
	onBlur?: () => void;
}

export function Checkbox({
	label,
	checked = false,
	onChange,
	help,
	disabled = false,
	className,
	name,
	value,
	onBlur,
}: CheckboxProps) {
	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(e.target.checked);
	};

	const checkbox = (
		<EvergreenCheckbox
			label={label}
			checked={checked}
			onChange={handleChange}
			disabled={disabled}
			name={name}
		/>
	);

	if (!help) {
		return <Pane className={className}>{checkbox}</Pane>;
	}

	return (
		<FormField
			description={help}
			className={classNames(css.formField, className)}
		>
			{checkbox}
		</FormField>
	);
}

// Alias for backwards compatibility with WordPress naming
export const CheckboxControl = Checkbox;

export default Checkbox;
