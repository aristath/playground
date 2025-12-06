/**
 * TabPanel Component
 *
 * A WordPress-compatible TabPanel component built on evergreen-ui tabs.
 */

import React, { useState, useCallback } from 'react';
import { Pane, Tab, Tablist } from 'evergreen-ui';

export interface TabPanelTab {
	name: string;
	title: string;
	className?: string;
	disabled?: boolean;
}

export interface TabPanelProps {
	tabs: TabPanelTab[];
	children: (tab: TabPanelTab) => React.ReactNode;
	className?: string;
	initialTabName?: string;
	onSelect?: (tabName: string) => void;
	orientation?: 'horizontal' | 'vertical';
}

export function TabPanel({
	tabs,
	children,
	className,
	initialTabName,
	onSelect,
	orientation = 'horizontal',
}: TabPanelProps) {
	const [selectedTabName, setSelectedTabName] = useState(
		initialTabName || tabs[0]?.name || ''
	);

	const handleTabSelect = useCallback(
		(tabName: string) => {
			setSelectedTabName(tabName);
			onSelect?.(tabName);
		},
		[onSelect]
	);

	const selectedTab =
		tabs.find((tab) => tab.name === selectedTabName) || tabs[0];

	return (
		<Pane
			className={className}
			display="flex"
			flexDirection={orientation === 'horizontal' ? 'column' : 'row'}
			height="100%"
		>
			<Tablist
				display="flex"
				flexDirection={orientation === 'horizontal' ? 'row' : 'column'}
				marginBottom={orientation === 'horizontal' ? 8 : 0}
				marginRight={orientation === 'vertical' ? 16 : 0}
				flexShrink={0}
			>
				{tabs.map((tab) => (
					<Tab
						key={tab.name}
						id={tab.name}
						onSelect={() => handleTabSelect(tab.name)}
						isSelected={selectedTabName === tab.name}
						disabled={tab.disabled}
						className={tab.className}
						aria-controls={`panel-${tab.name}`}
					>
						{tab.title}
					</Tab>
				))}
			</Tablist>
			<Pane
				role="tabpanel"
				id={`panel-${selectedTab?.name}`}
				aria-labelledby={selectedTab?.name}
				flex={1}
				overflow="auto"
			>
				{selectedTab && children(selectedTab)}
			</Pane>
		</Pane>
	);
}
