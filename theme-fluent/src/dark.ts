import { defineTheme } from '@directus/extensions-sdk';

/**
 * Fluent Design Dark Theme for Directus
 * Inspired by Microsoft Fluent Design System (Dark Mode)
 */
export default defineTheme({
	id: 'fluent-dark',
	name: 'Fluent Design Dark',
	appearance: 'dark',
	rules: {
		// === Base Styling ===
		borderRadius: '8px',
		borderWidth: '1px',

		// === Colors (Dark Mode) ===
		foreground: '#F3F2F1',                    // Neutral Gray 20
		foregroundAccent: '#FFFFFF',              // Pure white for emphasis
		foregroundSubdued: '#A19F9D',             // Neutral Gray 90

		background: '#1B1A19',                    // Neutral Gray 190
		backgroundNormal: '#252423',              // Neutral Gray 180
		backgroundAccent: '#292827',              // Neutral Gray 170
		backgroundSubdued: '#201F1E',             // Neutral Gray 200
		backgroundPage: '#1B1A19',

		borderColor: '#3B3A39',                   // Neutral Gray 150
		borderColorAccent: '#484644',             // Neutral Gray 140
		borderColorSubdued: '#292827',            // Neutral Gray 170

		// === Primary Color (Fluent Blue) ===
		primary: '#4CC2FF',                       // Light blue for dark mode
		primaryBackground: 'rgba(76, 194, 255, 0.15)',
		primarySubdued: 'rgba(76, 194, 255, 0.5)',
		primaryAccent: '#60CDFF',

		// === Secondary Color ===
		secondary: '#B4A0FF',                     // Light purple for dark mode
		secondaryBackground: 'rgba(180, 160, 255, 0.15)',
		secondarySubdued: 'rgba(180, 160, 255, 0.5)',
		secondaryAccent: '#C7B8FF',

		// === Status Colors ===
		success: '#6CCB5F',                       // Light green
		successBackground: 'rgba(108, 203, 95, 0.15)',
		successSubdued: 'rgba(108, 203, 95, 0.5)',
		successAccent: '#8AE07B',

		warning: '#FCE100',                       // Bright yellow
		warningBackground: 'rgba(252, 225, 0, 0.15)',
		warningSubdued: 'rgba(252, 225, 0, 0.5)',
		warningAccent: '#FFF171',

		danger: '#FF6B6B',                        // Light red
		dangerBackground: 'rgba(255, 107, 107, 0.15)',
		dangerSubdued: 'rgba(255, 107, 107, 0.5)',
		dangerAccent: '#FF8080',

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
			background: '#252423',
			backgroundAccent: '#292827',

			borderColor: '#3B3A39',
			borderWidth: '1px',

			project: {
				borderColor: '#3B3A39',
				borderWidth: '0px 0px 1px 0px',
				background: '#252423',
				foreground: '#F3F2F1',
				fontFamily: '"Segoe UI", sans-serif',
			},

			modules: {
				background: '#201F1E',
				borderColor: '#3B3A39',
				borderWidth: '0px 1px 0px 0px',

				button: {
					foreground: '#A19F9D',
					foregroundHover: '#F3F2F1',
					foregroundActive: '#4CC2FF',

					background: 'transparent',
					backgroundHover: 'rgba(76, 194, 255, 0.1)',
					backgroundActive: 'rgba(76, 194, 255, 0.2)',
				},
			},

			list: {
				icon: {
					foreground: '#A19F9D',
					foregroundHover: '#4CC2FF',
					foregroundActive: '#4CC2FF',
				},

				foreground: '#F3F2F1',
				foregroundHover: '#FFFFFF',
				foregroundActive: '#4CC2FF',

				background: 'transparent',
				backgroundHover: 'rgba(76, 194, 255, 0.1)',
				backgroundActive: 'rgba(76, 194, 255, 0.2)',

				fontFamily: '"Segoe UI", sans-serif',

				divider: {
					borderColor: '#3B3A39',
					borderWidth: '1px',
				},
			},
		},

		// === Header ===
		header: {
			background: '#252423',
			backgroundAccent: '#292827',

			borderColor: '#3B3A39',
			borderWidth: '0px 0px 1px 0px',

			boxShadow: '0 0.3px 0.9px rgba(0, 0, 0, 0.3), 0 1.6px 3.6px rgba(0, 0, 0, 0.4)',

			headline: {
				foreground: '#F3F2F1',
				fontFamily: '"Segoe UI Semibold", "Segoe UI", sans-serif',
				fontWeight: '600',
			},

			title: {
				foreground: '#F3F2F1',
				fontFamily: '"Segoe UI", sans-serif',
				fontWeight: '600',
			},

			subtitle: {
				foreground: '#A19F9D',
				fontFamily: '"Segoe UI", sans-serif',
				fontWeight: '400',
			},

			art: {
				foreground: '#3B3A39',
			},
		},

		// === Form Fields ===
		form: {
			field: {
				label: {
					foreground: '#F3F2F1',
					fontFamily: '"Segoe UI", sans-serif',
				},

				input: {
					background: '#292827',
					backgroundSubdued: '#252423',

					foreground: '#F3F2F1',
					foregroundSubdued: '#A19F9D',

					borderColor: '#3B3A39',
					borderColorHover: '#4CC2FF',
					borderColorFocus: '#4CC2FF',

					boxShadow: 'none',
					boxShadowHover: '0 0 0 1px #4CC2FF',
					boxShadowFocus: '0 0 0 2px #4CC2FF',

					height: '40px',
					padding: '12px',
				},
			},
		},

		// === Sidebar ===
		sidebar: {
			background: '#252423',
			foreground: '#F3F2F1',
			fontFamily: '"Segoe UI", sans-serif',

			borderColor: '#3B3A39',
			borderWidth: '0px 0px 0px 1px',

			section: {
				form: {
					background: '#252423',
					foreground: '#F3F2F1',
				},

				toggle: {
					borderColor: '#3B3A39',
					borderWidth: '1px',

					background: '#292827',
					backgroundHover: '#3B3A39',
					backgroundActive: '#4CC2FF',

					foreground: '#F3F2F1',
					foregroundHover: '#FFFFFF',
					foregroundActive: '#1B1A19',

					icon: {
						foreground: '#A19F9D',
						foregroundHover: '#4CC2FF',
						foregroundActive: '#1B1A19',
					},
				},
			},
		},

		// === Popover ===
		popover: {
			background: '#292827',
			borderColor: '#3B3A39',
			borderWidth: '1px',
			boxShadow: '0 3.2px 7.2px rgba(0, 0, 0, 0.5), 0 0.6px 1.8px rgba(0, 0, 0, 0.4)',
		},

		// === Banner ===
		banner: {
			background: '#433519',
			foreground: '#F3F2F1',
			avatar: {
				foreground: '#F3F2F1',
				background: '#292827',
			},
		},

		// === Public Pages ===
		public: {
			art: {
				background: 'linear-gradient(135deg, #0078D4 0%, #8764B8 100%)',
				primary: 'rgba(255, 255, 255, 0.95)',
				secondary: 'rgba(255, 255, 255, 0.75)',
			},
			background: '#1B1A19',
			foreground: '#F3F2F1',
		},
	},
});
