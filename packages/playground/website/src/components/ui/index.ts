/**
 * UI Components
 *
 * This module exports all UI components built on evergreen-ui.
 * These are drop-in replacements for @wordpress/components.
 */

// Theme
export { playgroundTheme, default as theme } from './theme';

// Core components
export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Modal } from './Modal';
export type { ModalProps } from './Modal';

export { TextInput, TextControl } from './TextInput';
export type { TextInputProps } from './TextInput';

export { Select, SelectControl } from './Select';
export type { SelectProps, SelectOption } from './Select';

export { Checkbox, CheckboxControl } from './Checkbox';
export type { CheckboxProps } from './Checkbox';

export { TextArea, TextareaControl } from './TextArea';
export type { TextAreaProps } from './TextArea';

export { RadioControl } from './Radio';
export type { RadioControlProps, RadioOption } from './Radio';

export { BaseControl } from './BaseControl';
export type { BaseControlProps } from './BaseControl';

export { Notice } from './Notice';
export type { NoticeProps } from './Notice';

export { Spinner } from './Spinner';
export type { SpinnerProps } from './Spinner';

export {
	Flex,
	FlexItem,
	VStack,
	HStack,
	__experimentalVStack,
	__experimentalHStack,
} from './Flex';
export type { FlexProps, FlexItemProps, StackProps } from './Flex';

export { MenuItem, DropdownMenu, Dropdown } from './Menu';
export type { MenuItemProps, DropdownMenuProps } from './Menu';

// Re-export commonly used evergreen-ui components that don't need wrapping
export {
	Pane,
	Heading,
	Text,
	Paragraph,
	Strong,
	Code,
	Pre,
	Link,
	Icon,
	IconButton,
	Tooltip,
	Badge,
	Pill,
	Tab,
	Tablist,
	TabNavigation,
	Table,
	Avatar,
	toaster,
	ThemeProvider,
} from 'evergreen-ui';

// Custom hooks
export { useMediaQuery } from './hooks';

// Icons
export { cog, CogIcon } from './icons';
