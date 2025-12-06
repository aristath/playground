/**
 * TextInput component using evergreen-ui
 *
 * Drop-in replacement for @wordpress/components TextControl
 */

import React, { forwardRef } from 'react';
import { TextInput as EvergreenTextInput, FormField, Pane } from 'evergreen-ui';
import classNames from 'classnames';
import css from './FormControls.module.css';

export interface TextInputProps {
	/** Label for the input */
	label?: string;
	/** Input value */
	value: string;
	/** Change handler */
	onChange: (value: string) => void;
	/** Placeholder text */
	placeholder?: string;
	/** Help text displayed below the input */
	help?: string;
	/** Whether the input is disabled */
	disabled?: boolean;
	/** Input type */
	type?: 'text' | 'password' | 'email' | 'url' | 'number';
	/** Additional CSS class name */
	className?: string;
	/** Input name attribute */
	name?: string;
	/** Whether the field is required */
	required?: boolean;
	/** Auto-complete attribute */
	autoComplete?: string;
	/** Whether to auto focus the input */
	autoFocus?: boolean;
	/** Maximum length */
	maxLength?: number;
	/** Data attributes for password manager ignore */
	'data-1p-ignore'?: string;
	'data-lpignore'?: string;
	'data-bwignore'?: string;
	/** WordPress-specific prop for margin (ignored) */
	__nextHasNoMarginBottom?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
	function TextInput(
		{
			label,
			value,
			onChange,
			placeholder,
			help,
			disabled = false,
			type = 'text',
			className,
			name,
			required = false,
			autoComplete,
			autoFocus,
			maxLength,
			__nextHasNoMarginBottom,
			...rest
		},
		ref
	) {
		const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			onChange(e.target.value);
		};

		const input = (
			<EvergreenTextInput
				ref={ref}
				value={value}
				onChange={handleChange}
				placeholder={placeholder}
				disabled={disabled}
				type={type}
				name={name}
				required={required}
				autoComplete={autoComplete}
				autoFocus={autoFocus}
				maxLength={maxLength}
				width="100%"
				{...rest}
			/>
		);

		if (!label && !help) {
			return <Pane className={className}>{input}</Pane>;
		}

		return (
			<FormField
				label={label}
				description={help}
				className={classNames(css.formField, className)}
				isRequired={required}
			>
				{input}
			</FormField>
		);
	}
);

// Alias for backwards compatibility with WordPress naming
export const TextControl = TextInput;

export default TextInput;
