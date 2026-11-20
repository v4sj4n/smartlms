import { useCallback, useEffect } from "react";
import { useAuth } from "./auth";
import { useAppearance, useUpdateAppearance } from "./queries";
import { type FontPreference, type ThemePreference, useTheme } from "./theme";
import { toastApiError } from "./toast";

/**
 * Applies the signed-in user's saved appearance (user_appearance) whenever it
 * loads, so it follows the user across browsers and devices.
 */
export function AppearanceSync() {
	const { session } = useAuth();
	const { data } = useAppearance(session?.user.id);
	const { setThemePreference, setFont } = useTheme();

	useEffect(() => {
		if (!data) return;
		setThemePreference(data.theme);
		setFont(data.font);
	}, [data, setThemePreference, setFont]);

	return null;
}

/** Changes appearance immediately and saves it to the user's record. */
export function useSaveAppearance() {
	const { session } = useAuth();
	const userId = session?.user.id;
	const { themePreference, font, setThemePreference, setFont } = useTheme();
	const update = useUpdateAppearance(userId);

	const save = useCallback(
		(next: { theme?: ThemePreference; font?: FontPreference }) => {
			const theme = next.theme ?? themePreference;
			const nextFont = next.font ?? font;
			const previous = { theme: themePreference, font };
			setThemePreference(theme);
			setFont(nextFont);
			if (!userId) return;
			update.mutate(
				{ user_id: userId, theme, font: nextFont },
				{
					onError: (error) => {
						setThemePreference(previous.theme);
						setFont(previous.font);
						toastApiError(error, "Appearance could not be saved");
					},
				},
			);
		},
		[userId, themePreference, font, setThemePreference, setFont, update],
	);

	return { themePreference, font, save, saving: update.isPending };
}
