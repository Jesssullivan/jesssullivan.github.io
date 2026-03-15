import { browser } from '$app/environment';

export interface ThemeOption {
	id: string;
	label: string;
	colors: [string, string, string]; // primary, secondary, tertiary swatches
}

export const THEMES: ThemeOption[] = [
	{ id: 'pine', label: 'TSS', colors: ['#8a9a5b', '#9b4dca', '#e2e8f0'] },
	{ id: 'rose', label: 'Rose', colors: ['#fb7185', '#fdba74', '#a78bfa'] },
	{ id: 'catppuccin', label: 'Catppuccin', colors: ['#8839ef', '#fe640b', '#40a02b'] },
	{ id: 'pride', label: 'Goth', colors: ['#E40303', '#FF8C00', '#732982'] },
	{ id: 'trans', label: 'xoxd', colors: ['#5bcefa', '#f5a9b8', '#ffffff'] },
];

export type ColorMode = 'light' | 'dark' | 'system';

class ThemeStore {
	mode = $state<ColorMode>('system');
	currentTheme = $state('pine');
	isDark = $derived(
		this.mode === 'dark' ||
		(this.mode === 'system' && browser && window.matchMedia('(prefers-color-scheme: dark)').matches)
	);

	init() {
		if (!browser) return;

		// Read persisted values
		const storedMode = localStorage.getItem('color-mode') as ColorMode | null;
		const storedTheme = localStorage.getItem('skeleton-theme');

		if (storedMode === 'light' || storedMode === 'dark') {
			this.mode = storedMode;
		} else {
			this.mode = 'system';
		}

		if (storedTheme && THEMES.some(t => t.id === storedTheme)) {
			this.currentTheme = storedTheme;
		}

		// Apply to DOM
		this.applyMode();
		this.applyTheme();

		// Listen for system preference changes
		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			if (this.mode === 'system') this.applyMode();
		});
	}

	setMode(mode: ColorMode) {
		this.mode = mode;
		if (browser) {
			if (mode === 'system') {
				localStorage.removeItem('color-mode');
			} else {
				localStorage.setItem('color-mode', mode);
			}
			this.applyMode();
		}
	}

	setTheme(themeId: string) {
		this.currentTheme = themeId;
		if (browser) {
			localStorage.setItem('skeleton-theme', themeId);
			this.applyTheme();
		}
	}

	private applyMode() {
		if (!browser) return;
		const resolved = this.mode === 'system'
			? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
			: this.mode;
		document.documentElement.setAttribute('data-mode', resolved);
		document.documentElement.style.colorScheme = resolved;
	}

	private applyTheme() {
		if (!browser) return;
		document.documentElement.setAttribute('data-theme', this.currentTheme);
	}
}

export const theme = new ThemeStore();
