/**
 * Select component using evergreen-ui
 *
 * Drop-in replacement for @wordpress/components SelectControl
 */

import React from 'react';
import { Select as EvergreenSelect, FormField, Pane } from 'evergreen-ui';
import classNames from 'classnames';
import css from './FormControls.module.css';

export interface SelectOption {
	label: string;
	value: string;
	disabled?: boolean;
}

export interface SelectProps {
	/** Label for the select */
	label?: string;
	/** Selected value */
	value: string;
	/** Change handler */
	onChange: (value: string) => void;
	/** Options to display */
	options: SelectOption[];
	/** Help text displayed below the select */
	help?: string;
	/** Whether the select is disabled */
	disabled?: boolean;
	/** Additional CSS class name */
	className?: string;
	/** Select name attribute */
	name?: string;
	/** Whether the field is required */
	required?: boolean;
}

export function Select({
	label,
	value,
	onChange,
	options,
	help,
	disabled = false,
	className,
	name,
	required = false,
}: SelectProps) {
	const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		onChange(e.target.value);
	};

	const select = (
		<EvergreenSelect
			value={value}
			onChange={handleChange}
			disabled={disabled}
			name={name}
			required={required}
			width="100%"
		>
			{options.map((option) => (
				<option
					key={option.value}
					value={option.value}
					disabled={option.disabled}
				>
					{option.label}
				</option>
			))}
		</EvergreenSelect>
	);

	if (!label && !help) {
		return <Pane className={className}>{select}</Pane>;
	}

	return (
		<FormField
			label={label}
			description={help}
			className={classNames(css.formField, className)}
			isRequired={required}
		>
			{select}
		</FormField>
	);
}

// Alias for backwards compatibility with WordPress naming
export const SelectControl = Select;

export default Select;
