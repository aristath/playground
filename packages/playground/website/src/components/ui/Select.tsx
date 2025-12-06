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
	/** Change handler - can receive just value or value + extra info with event */
	onChange: (
		value: string,
		extra?: { event?: React.ChangeEvent<HTMLSelectElement> }
	) => void;
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
	/** onBlur handler (WordPress compatibility) */
	onBlur?: () => void;
	/** Size variant (WordPress compatibility - ignored) */
	size?: 'default' | 'compact' | 'small';
	/** Label position (WordPress compatibility - ignored) */
	labelPosition?: 'top' | 'side';
	/** WordPress internal flag (ignored) */
	__nextHasNoMarginBottom?: boolean;
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
	onBlur,
}: SelectProps) {
	const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		onChange(e.target.value, { event: e });
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
