import type { ReactNode } from "react";

export type BadgeTone =
	| "neutral"
	| "primary"
	| "success"
	| "warning"
	| "error"
	| "outline";

const TONE_CLASS: Record<BadgeTone, string> = {
	neutral: "",
	primary: "badge--primary",
	success: "badge--success",
	warning: "badge--warning",
	error: "badge--error",
	outline: "badge--outline",
};

export function Badge({
	children,
	tone = "neutral",
	icon,
	title,
}: {
	children: ReactNode;
	tone?: BadgeTone;
	icon?: ReactNode;
	title?: string;
}) {
	return (
		<span
			className={["badge", TONE_CLASS[tone]].filter(Boolean).join(" ")}
			title={title}
		>
			{icon}
			{children}
		</span>
	);
}
