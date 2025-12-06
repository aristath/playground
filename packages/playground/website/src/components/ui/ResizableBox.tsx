/**
 * ResizableBox component
 *
 * A simple resizable container that allows horizontal resizing.
 * Replacement for @wordpress/components ResizableBox.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import classNames from 'classnames';

export interface ResizableBoxProps {
	/** Minimum width in pixels */
	minWidth?: number;
	/** Maximum width in pixels */
	maxWidth?: number;
	/** Initial/current size */
	size: {
		width: number | string;
		height: number | string;
	};
	/** Which sides can be resized */
	enable?: {
		top?: boolean;
		right?: boolean;
		bottom?: boolean;
		left?: boolean;
	};
	/** Callback when resize stops */
	onResizeStop?: (
		event: MouseEvent,
		direction: string,
		element: HTMLDivElement
	) => void;
	/** Show resize handle */
	showHandle?: boolean;
	/** Custom handle classes */
	handleClasses?: {
		right?: string;
		left?: string;
		top?: string;
		bottom?: string;
	};
	/** Children */
	children: React.ReactNode;
	/** Additional class name */
	className?: string;
}

export function ResizableBox({
	minWidth = 100,
	maxWidth,
	size,
	enable = { right: true },
	onResizeStop,
	showHandle = true,
	handleClasses = {},
	children,
	className,
}: ResizableBoxProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState<number | string>(size.width);
	const [isResizing, setIsResizing] = useState(false);
	const startXRef = useRef(0);
	const startWidthRef = useRef(0);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (!enable.right) return;
			e.preventDefault();
			setIsResizing(true);
			startXRef.current = e.clientX;
			startWidthRef.current = containerRef.current?.offsetWidth || 0;
		},
		[enable.right]
	);

	const handleMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!isResizing) return;

			const delta = e.clientX - startXRef.current;
			let newWidth = startWidthRef.current + delta;

			if (minWidth && newWidth < minWidth) newWidth = minWidth;
			if (maxWidth && newWidth > maxWidth) newWidth = maxWidth;

			setWidth(newWidth);
		},
		[isResizing, minWidth, maxWidth]
	);

	const handleMouseUp = useCallback(
		(e: MouseEvent) => {
			if (!isResizing) return;
			setIsResizing(false);

			if (onResizeStop && containerRef.current) {
				onResizeStop(e, 'right', containerRef.current);
			}
		},
		[isResizing, onResizeStop]
	);

	useEffect(() => {
		if (isResizing) {
			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			return () => {
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
			};
		}
	}, [isResizing, handleMouseMove, handleMouseUp]);

	// Update width if size prop changes externally
	useEffect(() => {
		setWidth(size.width);
	}, [size.width]);

	return (
		<div
			ref={containerRef}
			className={classNames(className)}
			style={{
				width: typeof width === 'number' ? `${width}px` : width,
				height: size.height,
				position: 'relative',
				flexShrink: 0,
			}}
		>
			{children}
			{enable.right && showHandle && (
				<div
					className={handleClasses.right}
					onMouseDown={handleMouseDown}
					style={{
						position: 'absolute',
						top: 0,
						right: 0,
						width: 8,
						height: '100%',
						cursor: 'ew-resize',
						zIndex: 10,
					}}
				/>
			)}
		</div>
	);
}
