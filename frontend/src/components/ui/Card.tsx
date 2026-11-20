import type { ReactNode } from "react";

export function Card({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={["card", className ?? ""].filter(Boolean).join(" ")}>
			{children}
		</section>
	);
}

export function CardHeader({
	title,
	hint,
	icon,
	actions,
}: {
	title: ReactNode;
	hint?: ReactNode;
	icon?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<header className="card__header">
			<div className="card__heading">
				{icon}
				<h2 className="card__title">{title}</h2>
				{hint ? <span className="card__hint">{hint}</span> : null}
			</div>
			{actions ? <div className="row">{actions}</div> : null}
		</header>
	);
}

export function CardBody({
	children,
	tight = false,
	className,
}: {
	children: ReactNode;
	tight?: boolean;
	className?: string;
}) {
	return (
		<div
			className={[
				"card__body",
				tight ? "card__body--tight" : "",
				className ?? "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			{children}
		</div>
	);
}

export function CardFooter({ children }: { children: ReactNode }) {
	return <footer className="card__footer">{children}</footer>;
}
