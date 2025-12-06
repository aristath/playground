/**
 * Spinner component using evergreen-ui
 *
 * Drop-in replacement for @wordpress/components Spinner
 */

import React from 'react';
import { Spinner as EvergreenSpinner, Pane } from 'evergreen-ui';

export interface SpinnerProps {
	/** Size of the spinner in pixels */
	size?: number;
	/** Additional CSS class name */
	className?: string;
	/** Inline styles */
	style?: React.CSSProperties;
}

export function Spinner({ size = 24, className, style }: SpinnerProps) {
	// If style has width/height, use those for size
	const effectiveSize =
		style?.width && typeof style.width === 'string'
			? parseInt(style.width, 10)
			: size;

	if (style) {
		return (
			<Pane className={className} style={style}>
				<EvergreenSpinner size={effectiveSize} />
			</Pane>
		);
	}

	return <EvergreenSpinner size={effectiveSize} className={className} />;
}

export default Spinner;
