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

export { TabPanel } from './TabPanel';
export type { TabPanelProps, TabPanelTab } from './TabPanel';

export { ResizableBox } from './ResizableBox';
export type { ResizableBoxProps } from './ResizableBox';

export {
	Flex,
	FlexItem,
	FlexBlock,
	VStack,
	HStack,
	__experimentalVStack,
	__experimentalHStack,
} from './Flex';
export type { FlexProps, FlexItemProps, StackProps } from './Flex';

export { MenuItem, DropdownMenu, Dropdown } from './Menu';
export type { MenuItemProps, DropdownMenuProps } from './Menu';

export {
	NavigableMenu,
	MenuGroup,
	ItemGroup,
	Item,
	SidebarHeading,
	SidebarMenuItem,
	__experimentalItemGroup,
	__experimentalItem,
	__experimentalHeading,
} from './Navigation';
export type {
	NavigableMenuProps,
	MenuGroupProps,
	ItemGroupProps,
	ItemProps,
	SidebarHeadingProps,
	SidebarMenuItemProps,
} from './Navigation';

// Re-export commonly used evergreen-ui components that don't need wrapping
export {
	Pane,
	Heading,
	Text,
	Text as __experimentalText,
	Paragraph,
	Strong,
	Code,
	Pre,
	Link,
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
export {
	cog,
	CogIcon,
	close,
	page,
	details,
	folder,
	layout,
	chevronLeft,
	edit,
	moreVertical,
	download,
	external,
	info,
	undo,
	cloud,
	upload,
	Icon,
} from './icons';
