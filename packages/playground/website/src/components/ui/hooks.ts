/**
 * Custom hooks replacing @wordpress/compose functionality
 */

import { useState, useEffect } from 'react';

/**
 * A hook that returns whether the given media query matches.
 *
 * @param query - The media query to check, e.g. "(max-width: 875px)"
 * @returns Whether the media query matches
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(() => {
		if (typeof window === 'undefined') {
			return false;
		}
		return window.matchMedia(query).matches;
	});

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const mediaQueryList = window.matchMedia(query);
		const listener = (event: MediaQueryListEvent) => {
			setMatches(event.matches);
		};

		// Set initial value
		setMatches(mediaQueryList.matches);

		// Modern browsers
		if (mediaQueryList.addEventListener) {
			mediaQueryList.addEventListener('change', listener);
			return () => mediaQueryList.removeEventListener('change', listener);
		}

		// Legacy browsers
		mediaQueryList.addListener(listener);
		return () => mediaQueryList.removeListener(listener);
	}, [query]);

	return matches;
}
