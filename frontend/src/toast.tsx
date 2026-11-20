import { CheckCircle, type Icon, Info, Warning } from "@phosphor-icons/react";
import { toast as sonner, Toaster, type ToastT } from "sonner";
import { ApiError } from "./api";
import { useTheme } from "./theme";

type ToastType = "success" | "error" | "info" | "loading";

const ICONS: Record<ToastType, Icon> = {
	success: CheckCircle,
	error: Warning,
	info: Info,
	loading: Info,
};

function ToastIcon({ type }: { type: ToastType }) {
	const Icon = ICONS[type];
	return <Icon size={16} weight="fill" aria-hidden="true" />;
}

/**
 * One Toaster for the whole app. `theme` follows the resolved light/dark state
 * and the surfaces are painted with our own tokens, so toasts look like the
 * rest of the interface in both themes.
 */
export function AppToaster() {
	const { theme } = useTheme();

	return (
		<Toaster
			theme={theme}
			position="bottom-right"
			closeButton={false}
			gap={8}
			offset={20}
			icons={{
				success: <ToastIcon type="success" />,
				error: <ToastIcon type="error" />,
				info: <ToastIcon type="info" />,
				warning: <ToastIcon type="error" />,
				loading: <ToastIcon type="loading" />,
			}}
			toastOptions={{ classNames: { toast: "sl-toast" } }}
		/>
	);
}

/** Plain success toast. */
export function toastSuccess(title: string, description?: string) {
	sonner.success(title, description ? { description } : undefined);
}

/** Plain failure toast. Pass the API's text as the title. */
export function toastError(title: string, description?: string) {
	sonner.error(title, description ? { description } : undefined);
}

export function toastInfo(title: string, description?: string) {
	sonner.info(title, description ? { description } : undefined);
}

/**
 * Reports a thrown API error. The API's own `{"error": ...}` text is the toast
 * title; transport failures get a plain-language message instead.
 */
export function toastApiError(
	error: unknown,
	fallback = "Something went wrong",
) {
	if (error instanceof ApiError) {
		const message = error.apiMessage();
		if (error.status === 0) {
			toastError(
				"Cannot reach the server",
				"The OptimoLMS backend on :8081 did not respond.",
			);
			return;
		}
		toastError(
			message ?? fallback,
			message ? undefined : `HTTP ${error.status}`,
		);
		return;
	}
	toastError(fallback, error instanceof Error ? error.message : undefined);
}

export type { ToastT };
export { sonner as toast };
