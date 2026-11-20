/** Static placeholder for content that is loading. No shimmer, no pulse. */
export function Skeleton({
	variant = "line",
	width,
}: {
	variant?: "line" | "title" | "short";
	width?: string;
}) {
	const variantClass =
		variant === "title"
			? "skeleton--title"
			: variant === "short"
				? "skeleton--short"
				: "skeleton--line";

	return (
		<div
			className={["skeleton", variantClass].join(" ")}
			style={width ? { width } : undefined}
			aria-hidden="true"
		/>
	);
}

export function SkeletonStack({ rows = 3 }: { rows?: number }) {
	return (
		<div className="skeleton-stack" aria-hidden="true">
			<div className="skeleton skeleton--title" />
			{Array.from({ length: rows }, (_, index) => (
				<div
					key={index}
					className="skeleton skeleton--line"
					style={{ width: index % 2 === 0 ? "100%" : "72%" }}
				/>
			))}
		</div>
	);
}
