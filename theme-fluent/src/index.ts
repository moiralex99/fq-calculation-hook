import { defineTheme } from '@directus/extensions-sdk';

/**
 * Fluent Design Theme for Directus
 * Inspired by Microsoft Fluent Design System
 * 
 * Features:
 * - Soft, rounded corners (Fluent style)
 * - Acrylic-like backgrounds with subtle transparency
 * - Consistent spacing and elevation
 * - Modern blue accent color (#0078D4)
 * - Smooth transitions and depth
 */
export default defineTheme({
	id: 'fluent',
	name: 'Fluent Design',
	appearance: 'light',
	rules: {
		// === Base Styling ===
		borderRadius: '8px',
		borderWidth: '1px',

		// === Colors ===
		// Fluent uses a sophisticated gray scale
		foreground: '#323130',                    // Neutral Gray 190
		foregroundAccent: '#201F1E',              // Neutral Gray 210
		foregroundSubdued: '#605E5C',             // Neutral Gray 130

		background: '#FAF9F8',                    // Neutral Gray 10 (warm white)
		backgroundNormal: '#F3F2F1',              // Neutral Gray 20
		backgroundAccent: '#EDEBE9',              // Neutral Gray 30
		backgroundSubdued: '#FFFFFF',             // Pure white for cards
		backgroundPage: '#FAF9F8',                // Same as background

		borderColor: '#EDEBE9',                   // Neutral Gray 30
		borderColorAccent: '#E1DFDD',             // Neutral Gray 40
		borderColorSubdued: '#F3F2F1',            // Neutral Gray 20

		// === Primary Color (Fluent Blue) ===
		primary: '#0078D4',                       // Communication Blue
		primaryBackground: 'rgba(0, 120, 212, 0.1)',
		primarySubdued: 'rgba(0, 120, 212, 0.5)',
		primaryAccent: '#106EBE',                 // Darker blue for hover

		// === Secondary Color (Fluent Purple) ===
		secondary: '#8764B8',                     // Fluent Purple
		secondaryBackground: 'rgba(135, 100, 184, 0.1)',
		secondarySubdued: 'rgba(135, 100, 184, 0.5)',
		secondaryAccent: '#744DA9',

		// === Status Colors ===
		success: '#107C10',                       // Fluent Green
		successBackground: 'rgba(16, 124, 16, 0.1)',
		successSubdued: 'rgba(16, 124, 16, 0.5)',
		successAccent: '#0B6A0B',

		warning: '#F7630C',                       // Fluent Orange
		warningBackground: 'rgba(247, 99, 12, 0.1)',
		warningSubdued: 'rgba(247, 99, 12, 0.5)',
		warningAccent: '#D83B01',

		danger: '#D13438',                        // Fluent Red
		dangerBackground: 'rgba(209, 52, 56, 0.1)',
		dangerSubdued: 'rgba(209, 52, 56, 0.5)',
		dangerAccent: '#A4262C',

		// === Typography ===
		fonts: {
			display: {
				fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", sans-serif',
				fontWeight: '600',
			},
			sans: {
				fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", sans-serif',
				fontWeight: '400',
			},
			serif: {
				fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Roboto", "Helvetica Neue", sans-serif',
				fontWeight: '400',
			},
			monospace: {
				fontFamily: '"Cascadia Code", "Consolas", "Courier New", monospace',
				fontWeight: '400',
			},
		},

		// === Navigation ===
		navigation: {
			background: '#FFFFFF',
			backgroundAccent: '#F3F2F1',

			borderColor: '#EDEBE9',
			borderWidth: '1px',

			project: {
				borderColor: '#EDEBE9',
				borderWidth: '0px 0px 1px 0px',
				background: '#FFFFFF',
				foreground: '#323130',
				fontFamily: '"Segoe UI", sans-serif',
			},

			modules: {
				background: '#F3F2F1',              // Acrylic-like background
				borderColor: '#EDEBE9',
				borderWidth: '0px 1px 0px 0px',

				button: {
					foreground: '#605E5C',
					foregroundHover: '#323130',
					foregroundActive: '#0078D4',

					background: 'transparent',
					backgroundHover: 'rgba(0, 120, 212, 0.05)',
					backgroundActive: 'rgba(0, 120, 212, 0.1)',
				},
			},

			list: {
				icon: {
					foreground: '#605E5C',
					foregroundHover: '#0078D4',
					foregroundActive: '#0078D4',
				},

				foreground: '#323130',
				foregroundHover: '#201F1E',
				foregroundActive: '#0078D4',

				background: 'transparent',
				backgroundHover: 'rgba(0, 120, 212, 0.05)',
				backgroundActive: 'rgba(0, 120, 212, 0.1)',

				fontFamily: '"Segoe UI", sans-serif',

				divider: {
					borderColor: '#EDEBE9',
					borderWidth: '1px',
				},
			},
		},

		// === Header ===
		header: {
			background: '#FFFFFF',
			backgroundAccent: '#F3F2F1',

			borderColor: '#EDEBE9',
			borderWidth: '0px 0px 1px 0px',

			boxShadow: '0 0.3px 0.9px rgba(0, 0, 0, 0.07), 0 1.6px 3.6px rgba(0, 0, 0, 0.11)',

			headline: {
				foreground: '#323130',
				fontFamily: '"Segoe UI Semibold", "Segoe UI", sans-serif',
				fontWeight: '600',
			},

			title: {
				foreground: '#323130',
				fontFamily: '"Segoe UI", sans-serif',
				fontWeight: '600',
			},

			subtitle: {
				foreground: '#605E5C',
				fontFamily: '"Segoe UI", sans-serif',
				fontWeight: '400',
			},

			art: {
				foreground: '#EDEBE9',
			},
		},

		// === Form Fields ===
		form: {
			field: {
				label: {
					foreground: '#323130',
					fontFamily: '"Segoe UI", sans-serif',
				},

				input: {
					background: '#FFFFFF',
					backgroundSubdued: '#F3F2F1',

					foreground: '#323130',
					foregroundSubdued: '#605E5C',

					borderColor: '#EDEBE9',
					borderColorHover: '#0078D4',
					borderColorFocus: '#0078D4',

					boxShadow: 'none',
					boxShadowHover: '0 0 0 1px #0078D4',
					boxShadowFocus: '0 0 0 2px #0078D4',

					height: '40px',
					padding: '12px',
				},
			},
		},

		// === Sidebar ===
		sidebar: {
			background: '#FFFFFF',
			foreground: '#323130',
			fontFamily: '"Segoe UI", sans-serif',

			borderColor: '#EDEBE9',
			borderWidth: '0px 0px 0px 1px',

			section: {
				form: {
					background: '#FFFFFF',
					foreground: '#323130',
				},

				toggle: {
					borderColor: '#EDEBE9',
					borderWidth: '1px',

					background: '#F3F2F1',
					backgroundHover: '#EDEBE9',
					backgroundActive: '#0078D4',

					foreground: '#323130',
					foregroundHover: '#201F1E',
					foregroundActive: '#FFFFFF',

					icon: {
						foreground: '#605E5C',
						foregroundHover: '#0078D4',
						foregroundActive: '#FFFFFF',
					},
				},
			},
		},

		// === Popover ===
		popover: {
			background: '#FFFFFF',
			borderColor: '#EDEBE9',
			borderWidth: '1px',
			boxShadow: '0 3.2px 7.2px rgba(0, 0, 0, 0.132), 0 0.6px 1.8px rgba(0, 0, 0, 0.108)',
		},

		// === Banner ===
		banner: {
			background: '#FFF4CE',
			foreground: '#323130',
			avatar: {
				foreground: '#323130',
				background: '#FFFFFF',
			},
		},

		// === Public Pages (Login, etc.) ===
		public: {
			art: {
				background: 'linear-gradient(135deg, #0078D4 0%, #8764B8 100%)',
				primary: 'rgba(255, 255, 255, 0.9)',
				secondary: 'rgba(255, 255, 255, 0.7)',
			},
			background: '#FFFFFF',
			foreground: '#323130',
		},
	},
});
