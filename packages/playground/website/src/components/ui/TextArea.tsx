/**
 * TextArea component using evergreen-ui
 *
 * Drop-in replacement for @wordpress/components TextareaControl
 */

import React from 'react';
import { Textarea as EvergreenTextarea, FormField, Pane } from 'evergreen-ui';
import classNames from 'classnames';
import css from './FormControls.module.css';

export interface TextAreaProps {
	/** Label for the textarea */
	label?: string;
	/** Textarea value */
	value: string;
	/** Change handler */
	onChange: (value: string) => void;
	/** Placeholder text */
	placeholder?: string;
	/** Help text displayed below the textarea */
	help?: string;
	/** Whether the textarea is disabled */
	disabled?: boolean;
	/** Number of rows */
	rows?: number;
	/** Additional CSS class name */
	className?: string;
	/** Textarea name attribute */
	name?: string;
	/** Whether the field is required */
	required?: boolean;
	/** Auto focus the textarea */
	autoFocus?: boolean;
}

export function TextArea({
	label,
	value,
	onChange,
	placeholder,
	help,
	disabled = false,
	rows = 4,
	className,
	name,
	required = false,
	autoFocus = false,
}: TextAreaProps) {
	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value);
	};

	const textarea = (
		<EvergreenTextarea
			value={value}
			onChange={handleChange}
			placeholder={placeholder}
			disabled={disabled}
			name={name}
			required={required}
			width="100%"
			resize="vertical"
			autoFocus={autoFocus}
			style={{ minHeight: `${rows * 1.5}em` }}
		/>
	);

	if (!label && !help) {
		return <Pane className={className}>{textarea}</Pane>;
	}

	return (
		<FormField
			label={label}
			description={help}
			className={classNames(css.formField, className)}
			isRequired={required}
		>
			{textarea}
		</FormField>
	);
}

// Alias for backwards compatibility with WordPress naming
export const TextareaControl = TextArea;

export default TextArea;
