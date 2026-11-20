import { Field, FieldLabel } from "@ui-sdk/react/field";
import type { ReactNode } from "react";

/**
 * Labelled multi-line input wired like TextField: the ui-sdk Field connects
 * label/description/error through ids so screen readers announce them.
 */
export function TextArea({
	label,
	value,
	onChange,
	placeholder,
	rows = 4,
	hint,
	maxLength,
	disabled,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	rows?: number;
	hint?: ReactNode;
	maxLength?: number;
	disabled?: boolean;
}) {
	return (
		<Field className="field">
			<FieldLabel className="field__label">
				<span className="field__label-inner">
					{label}
					{maxLength ? (
						<span className="field__counter num">
							{value.length}/{maxLength}
						</span>
					) : null}
				</span>
			</FieldLabel>
			<div className="field__row">
				<textarea
					className="input input--area"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					placeholder={placeholder}
					rows={rows}
					maxLength={maxLength}
					disabled={disabled}
				/>
			</div>
			{hint ? <p className="field__description">{hint}</p> : null}
		</Field>
	);
}
