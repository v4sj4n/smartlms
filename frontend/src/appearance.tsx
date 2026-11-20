import { useCallback, useEffect } from "react";
import { useAuth } from "./auth";
import { useAppearance, useUpdateAppearance } from "./queries";
import {
	type AccentPreference,
	type ContrastPreference,
	type FontPreference,
	isAccentPreference,
	isContrastPreference,
	type ThemePreference,
	useTheme,
} from "./theme";
import { toastApiError } from "./toast";

type Appearance = {
	theme: ThemePreference;
	font: FontPreference;
	accent: AccentPreference;
	contrast: ContrastPreference;
};

/**
 * Applies the signed-in user's saved appearance (user_appearance) whenever it
 * loads, so it follows the user across browsers and devices.
 */
export function AppearanceSync() {
	const { session } = useAuth();
	const { data } = useAppearance(session?.user.id);
	const { setThemePreference, setFont, setAccent, setContrastPreference } =
		useTheme();

	useEffect(() => {
		if (!data) return;
		setThemePreference(data.theme);
		setFont(data.font);
		// A server ahead of this build may send an accent we do not ship yet.
		if (isAccentPreference(data.accent)) setAccent(data.accent);
		if (isContrastPreference(data.contrast))
			setContrastPreference(data.contrast);
	}, [data, setThemePreference, setFont, setAccent, setContrastPreference]);

	return null;
}

/** Changes appearance immediately and saves it to the user's record. */
export function useSaveAppearance() {
	const { session } = useAuth();
	const userId = session?.user.id;
	const {
		themePreference,
		font,
		accent,
		contrastPreference,
		setThemePreference,
		setFont,
		setAccent,
		setContrastPreference,
	} = useTheme();
	const update = useUpdateAppearance(userId);

	const save = useCallback(
		(next: Partial<Appearance>) => {
			const previous: Appearance = {
				theme: themePreference,
				font,
				accent,
				contrast: contrastPreference,
			};
			const value: Appearance = { ...previous, ...next };
			const apply = (a: Appearance) => {
				setThemePreference(a.theme);
				setFont(a.font);
				setAccent(a.accent);
				setContrastPreference(a.contrast);
			};
			apply(value);
			if (!userId) return;
			update.mutate(
				{ user_id: userId, ...value },
				{
					onError: (error) => {
						apply(previous);
						toastApiError(error, "Appearance could not be saved");
					},
				},
			);
		},
		[
			userId,
			themePreference,
			font,
			accent,
			contrastPreference,
			setThemePreference,
			setFont,
			setAccent,
			setContrastPreference,
			update,
		],
	);

	return {
		themePreference,
		font,
		accent,
		contrastPreference,
		save,
		saving: update.isPending,
	};
}
