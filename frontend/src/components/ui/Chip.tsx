import type { ReactNode } from "react";

export function Chip({
	children,
	tone = "default",
	icon,
	title,
}: {
	children: ReactNode;
	tone?: "default" | "muted" | "granted";
	icon?: ReactNode;
	title?: string;
}) {
	const toneClass =
		tone === "muted"
			? "chip--muted"
			: tone === "granted"
				? "chip--granted"
				: "";

	return (
		<span
			className={["chip", toneClass].filter(Boolean).join(" ")}
			title={title}
		>
			{icon}
			{children}
		</span>
	);
}
