/**
 * Radio components using evergreen-ui
 *
 * Drop-in replacement for @wordpress/components RadioControl
 */

import React from 'react';
import { Radio, RadioGroup, FormField, Pane, Text } from 'evergreen-ui';
import classNames from 'classnames';
import css from './FormControls.module.css';

export interface RadioOption {
	label: string;
	value: string;
}

export interface RadioControlProps {
	/** Label for the radio group */
	label?: string;
	/** Currently selected value */
	selected?: string;
	/** Available options */
	options: RadioOption[];
	/** Change handler */
	onChange: (value: string) => void;
	/** Help text displayed below the radio group */
	help?: string;
	/** Whether the control is disabled */
	disabled?: boolean;
	/** Additional CSS class name */
	className?: string;
}

export function RadioControl({
	label,
	selected,
	options,
	onChange,
	help,
	disabled = false,
	className,
}: RadioControlProps) {
	return (
		<Pane className={classNames(css.formField, className)}>
			{label && (
				<Text
					display="block"
					marginBottom={8}
					fontWeight={500}
					fontSize={13}
				>
					{label}
				</Text>
			)}
			<RadioGroup
				value={selected || ''}
				onChange={(e) => onChange(e.target.value)}
			>
				{options.map((option) => (
					<Radio
						key={option.value}
						value={option.value}
						label={option.label}
						disabled={disabled}
						marginBottom={8}
					/>
				))}
			</RadioGroup>
			{help && (
				<Text color="muted" fontSize={12} marginTop={4}>
					{help}
				</Text>
			)}
		</Pane>
	);
}

export default RadioControl;
