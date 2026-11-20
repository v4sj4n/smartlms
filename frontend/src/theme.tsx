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

export type ResolvedTheme = "light" | "dark";
export type ThemePreference = "system" | ResolvedTheme;
export type FontPreference = "system" | "legible" | "dyslexic";

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

// Keep both keys in sync with the pre-paint script in index.html. They are a
// local cache of the user's saved appearance so reloads paint it with no flash.
const THEME_KEY = "smartlms.theme.v1";
const FONT_KEY = "smartlms.font.v1";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
	return value === "system" || value === "light" || value === "dark";
}

export function isFontPreference(value: unknown): value is FontPreference {
	return value === "system" || value === "legible" || value === "dyslexic";
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
	setThemePreference: (preference: ThemePreference) => void;
	setFont: (font: FontPreference) => void;
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

	const value = useMemo<ThemeContextValue>(
		() => ({ theme, themePreference, font, setThemePreference, setFont }),
		[theme, themePreference, font, setThemePreference, setFont],
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
