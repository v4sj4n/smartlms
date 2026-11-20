import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({
	children,
	caption,
}: {
	children: ReactNode;
	caption?: string;
}) {
	return (
		<div className="table-wrapper">
			<table className="table">
				{caption ? (
					<caption className="visually-hidden">{caption}</caption>
				) : null}
				{children}
			</table>
		</div>
	);
}

export function Th({
	children,
	align = "left",
	className,
	...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
	return (
		<th
			scope="col"
			className={[align === "right" ? "table__num" : "", className ?? ""]
				.filter(Boolean)
				.join(" ")}
			{...rest}
		>
			{children}
		</th>
	);
}

export function Td({
	children,
	align = "left",
	className,
	...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" }) {
	return (
		<td
			className={[align === "right" ? "table__num" : "", className ?? ""]
				.filter(Boolean)
				.join(" ")}
			{...rest}
		>
			{children}
		</td>
	);
}
