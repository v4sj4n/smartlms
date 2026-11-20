import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
// @font-face rules only; a font file downloads only once its font is selected.
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/opendyslexic/400.css";
import "@fontsource/opendyslexic/700.css";
import {
	ACCENT_IDS,
	type AccentPreference,
	DEFAULT_ACCENT,
} from "./accents.generated";

export type { AccentPreference } from "./accents.generated";
export { ACCENT_OPTIONS } from "./accents.generated";

export type ResolvedTheme = "light" | "dark";
export type ThemePreference = "system" | ResolvedTheme;
export type FontPreference = "system" | "legible" | "dyslexic";
/** "system" follows the OS (prefers-contrast: more); "high" forces 7:1 text. */
export type ContrastPreference = "system" | "high";

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
	{ value: "system", label: "System" },
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
];

export const FONT_OPTIONS: {
	value: FontPreference;
	label: string;
	description: string;
}[] = [
	{ value: "system", label: "Default", description: "The system font" },
	{
		value: "legible",
		label: "Hyperlegible",
		description: "Atkinson Hyperlegible: distinct letter shapes for low vision",
	},
	{
		value: "dyslexic",
		label: "Dyslexia-friendly",
		description: "OpenDyslexic: weighted letter bottoms that resist flipping",
	},
];

export const CONTRAST_OPTIONS: {
	value: ContrastPreference;
	label: string;
	description: string;
}[] = [
	{
		value: "system",
		label: "Standard",
		description:
			"WCAG AA. Raised automatically when your device asks for more contrast",
	},
	{
		value: "high",
		label: "High",
		description:
			"WCAG AAA text (7:1), firmer borders and stronger status colors",
	},
];

// Keep these keys in sync with the pre-paint script in index.html. They are a
// local cache of the user's saved appearance so reloads paint it with no flash.
const THEME_KEY = "optimolms.theme.v1";
const FONT_KEY = "optimolms.font.v1";
const ACCENT_KEY = "optimolms.accent.v1";
const CONTRAST_KEY = "optimolms.contrast.v1";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const MORE_CONTRAST_QUERY = "(prefers-contrast: more)";

export function isThemePreference(value: unknown): value is ThemePreference {
	return value === "system" || value === "light" || value === "dark";
}

export function isFontPreference(value: unknown): value is FontPreference {
	return value === "system" || value === "legible" || value === "dyslexic";
}

export function isAccentPreference(value: unknown): value is AccentPreference {
	return (ACCENT_IDS as readonly unknown[]).includes(value);
}

export function isContrastPreference(
	value: unknown,
): value is ContrastPreference {
	return value === "system" || value === "high";
}

function readStored<T>(
	key: string,
	guard: (value: unknown) => value is T,
): T | null {
	try {
		const stored = window.localStorage.getItem(key);
		if (guard(stored)) return stored;
	} catch {
		// Storage unavailable: fall back to defaults.
	}
	return null;
}

function store(key: string, value: string) {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// A blocked write only costs persistence, not the current appearance.
	}
}

function systemTheme(): ResolvedTheme {
	return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

type ThemeContextValue = {
	/** The theme painted right now. */
	theme: ResolvedTheme;
	themePreference: ThemePreference;
	font: FontPreference;
	accent: AccentPreference;
	contrastPreference: ContrastPreference;
	/** The contrast painted right now. */
	contrast: "standard" | "high";
	setThemePreference: (preference: ThemePreference) => void;
	setFont: (font: FontPreference) => void;
	setAccent: (accent: AccentPreference) => void;
	setContrastPreference: (preference: ContrastPreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Theme and reading font. "system" theme follows `prefers-color-scheme` live.
 * The user's saved appearance (server-side) is pushed in through the setters;
 * localStorage only caches it for a flash-free first paint.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
	const [themePreference, setThemePreferenceState] = useState<ThemePreference>(
		() => readStored(THEME_KEY, isThemePreference) ?? "system",
	);
	const [font, setFontState] = useState<FontPreference>(
		() => readStored(FONT_KEY, isFontPreference) ?? "system",
	);
	const [system, setSystem] = useState<ResolvedTheme>(systemTheme);
	const [accent, setAccentState] = useState<AccentPreference>(
		() => readStored(ACCENT_KEY, isAccentPreference) ?? DEFAULT_ACCENT,
	);
	const [contrastPreference, setContrastState] = useState<ContrastPreference>(
		() => readStored(CONTRAST_KEY, isContrastPreference) ?? "system",
	);
	const [systemMore, setSystemMore] = useState(
		() => window.matchMedia(MORE_CONTRAST_QUERY).matches,
	);

	useEffect(() => {
		const query = window.matchMedia(MORE_CONTRAST_QUERY);
		const onChange = (event: MediaQueryListEvent) =>
			setSystemMore(event.matches);
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);

	const contrast: "standard" | "high" =
		contrastPreference === "high" || systemMore ? "high" : "standard";

	useEffect(() => {
		const root = document.documentElement;
		root.dataset.accent = accent;
		root.dataset.contrast = contrast;
	}, [accent, contrast]);

	useEffect(() => {
		const query = window.matchMedia(DARK_QUERY);
		const onChange = (event: MediaQueryListEvent) =>
			setSystem(event.matches ? "dark" : "light");
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);

	const theme: ResolvedTheme =
		themePreference === "system" ? system : themePreference;

	useEffect(() => {
		const root = document.documentElement;
		root.dataset.theme = theme;
		root.dataset.themePreference = themePreference;
		root.style.colorScheme = theme;
	}, [theme, themePreference]);

	useEffect(() => {
		const root = document.documentElement;
		if (font === "system") delete root.dataset.font;
		else root.dataset.font = font;
	}, [font]);

	const setThemePreference = useCallback((preference: ThemePreference) => {
		setThemePreferenceState(preference);
		store(THEME_KEY, preference);
	}, []);

	const setFont = useCallback((next: FontPreference) => {
		setFontState(next);
		store(FONT_KEY, next);
	}, []);

	const setAccent = useCallback((next: AccentPreference) => {
		setAccentState(next);
		store(ACCENT_KEY, next);
	}, []);

	const setContrastPreference = useCallback((next: ContrastPreference) => {
		setContrastState(next);
		store(CONTRAST_KEY, next);
	}, []);

	const value = useMemo<ThemeContextValue>(
		() => ({
			theme,
			themePreference,
			font,
			accent,
			contrastPreference,
			contrast,
			setThemePreference,
			setFont,
			setAccent,
			setContrastPreference,
		}),
		[
			theme,
			themePreference,
			font,
			accent,
			contrastPreference,
			contrast,
			setThemePreference,
			setFont,
			setAccent,
			setContrastPreference,
		],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	const value = useContext(ThemeContext);
	if (!value) {
		throw new Error("useTheme must be used inside <ThemeProvider>");
	}
	return value;
}
