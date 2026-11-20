import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: Variant;
	size?: "md" | "sm";
	block?: boolean;
	icon?: ReactNode;
	iconAfter?: ReactNode;
};

const VARIANT_CLASS: Record<Variant, string> = {
	primary: "btn--primary",
	secondary: "btn--secondary",
	ghost: "btn--ghost",
	danger: "btn--danger",
};

export function Button({
	variant = "secondary",
	size = "md",
	block = false,
	icon,
	iconAfter,
	className,
	type = "button",
	children,
	...rest
}: ButtonProps) {
	const classes = [
		"btn",
		VARIANT_CLASS[variant],
		size === "sm" ? "btn--sm" : "",
		block ? "btn--block" : "",
		className ?? "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button type={type} className={classes} {...rest}>
			{icon}
			{children}
			{iconAfter}
		</button>
	);
}
