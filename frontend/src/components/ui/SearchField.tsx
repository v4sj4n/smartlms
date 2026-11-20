import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

/**
 * Search box for lists. Typing updates the field at once and reports the value
 * after a short pause, so a server-side search is not sent per keystroke.
 */
export function SearchField({
	value,
	onChange,
	label,
	placeholder,
	delay = 250,
}: {
	value: string;
	onChange: (value: string) => void;
	/** Accessible name; the placeholder alone is not a label. */
	label: string;
	placeholder?: string;
	delay?: number;
}) {
	const [draft, setDraft] = useState(value);
	const latest = useRef(onChange);
	latest.current = onChange;

	// An outside change (back button, cleared filter) wins over the draft.
	useEffect(() => setDraft(value), [value]);

	useEffect(() => {
		if (draft === value) return;
		const timer = window.setTimeout(() => latest.current(draft.trim()), delay);
		return () => window.clearTimeout(timer);
	}, [draft, value, delay]);

	return (
		<div className="search-field">
			<MagnifyingGlass
				size={15}
				weight="regular"
				aria-hidden="true"
				className="search-field__icon"
			/>
			<input
				type="search"
				className="input search-field__input"
				aria-label={label}
				placeholder={placeholder ?? label}
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Escape" && draft) {
						event.stopPropagation();
						setDraft("");
					}
				}}
			/>
			{draft ? (
				<button
					type="button"
					className="search-field__clear"
					aria-label="Clear search"
					onClick={() => {
						setDraft("");
						latest.current("");
					}}
				>
					<X size={13} weight="bold" aria-hidden="true" />
				</button>
			) : null}
		</div>
	);
}

/** One-of-several filter shown as a compact segmented control. */
export function SegmentedFilter<T extends string>({
	value,
	options,
	onChange,
	label,
}: {
	value: T;
	options: { value: T; label: string }[];
	onChange: (value: T) => void;
	label: string;
}) {
	return (
		<div className="segmented" role="radiogroup" aria-label={label}>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					role="radio"
					aria-checked={option.value === value}
					className={[
						"segmented__option",
						option.value === value ? "segmented__option--active" : "",
					]
						.filter(Boolean)
						.join(" ")}
					onClick={() => onChange(option.value)}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}
