import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

/** Square, icon-only action button used in card and row toolbars. */
export function IconButton({
	label,
	icon,
	tone = "default",
	className,
	type = "button",
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	label: string;
	icon: ReactNode;
	tone?: "default" | "danger";
	ref?: Ref<HTMLButtonElement>;
}) {
	return (
		<button
			type={type}
			className={[
				"icon-btn",
				tone === "danger" ? "icon-btn--danger" : "",
				className ?? "",
			]
				.filter(Boolean)
				.join(" ")}
			aria-label={label}
			title={label}
			{...rest}
		>
			{icon}
		</button>
	);
}
