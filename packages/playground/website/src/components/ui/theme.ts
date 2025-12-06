/**
 * Evergreen UI Theme Configuration for WordPress Playground
 *
 * This theme maintains visual consistency with the existing Playground design
 * while leveraging evergreen-ui's component library.
 */

import { defaultTheme, mergeTheme } from 'evergreen-ui';

export const playgroundTheme = mergeTheme(defaultTheme, {
	// Color palette matching existing Playground colors
	colors: {
		...defaultTheme.colors,
		// Primary colors (WordPress admin theme)
		blue500: '#007cba',
		blue600: '#006ba1',
		blue700: '#005a87',
		// Gray scale matching CSS variables
		gray200: '#ddd',
		gray600: '#6a6a6a',
		gray900: '#1e1e1e',
		// Alert colors
		red500: '#cc1818',
	},
	// Component-specific theming
	components: {
		Button: {
			baseStyle: {
				fontFamily:
					"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
				fontWeight: '400',
				borderRadius: '6px',
			},
			appearances: {
				primary: {
					backgroundColor: '#1e2327',
					color: 'white',
				},
				default: {
					backgroundColor: 'transparent',
					color: 'inherit',
				},
			},
		},
		Dialog: {
			baseStyle: {
				maxWidth: '600px',
			},
		},
		TextInput: {
			baseStyle: {
				borderRadius: '4px',
			},
		},
		Select: {
			baseStyle: {
				borderRadius: '4px',
			},
		},
	},
	// Typography matching existing styles
	fontFamilies: {
		...defaultTheme.fontFamilies,
		ui: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
		display:
			"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
	},
});

export default playgroundTheme;
