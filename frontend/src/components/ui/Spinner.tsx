import { CircleNotch } from "@phosphor-icons/react";

/** Activity indicator for in-flight work. Colour follows the surrounding text. */
export function Spinner({
	size = 16,
	label,
}: {
	size?: number;
	label?: string;
}) {
	return (
		<span className="row" role="status" aria-live="polite">
			<CircleNotch
				size={size}
				weight="bold"
				className="spinner"
				aria-hidden="true"
			/>
			{label ? (
				<span>{label}</span>
			) : (
				<span className="visually-hidden">Loading</span>
			)}
		</span>
	);
}
