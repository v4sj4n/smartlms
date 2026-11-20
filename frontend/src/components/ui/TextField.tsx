import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import type { ReactNode } from "react";

/**
 * Labelled input for dialog forms. ui-sdk's Field wires the label, the
 * description and the error to the control (id / for / aria-describedby),
 * so validation messages are announced rather than just coloured red.
 */
export function TextField({
	label,
	value,
	onChange,
	onBlur,
	error,
	hint,
	type = "text",
	placeholder,
	autoFocus,
	disabled,
	min,
	inputMode,
	trailing,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	error?: string;
	hint?: ReactNode;
	type?:
		| "text"
		| "number"
		| "search"
		| "email"
		| "datetime-local"
		| "date"
		| "password";
	placeholder?: string;
	autoFocus?: boolean;
	disabled?: boolean;
	min?: number;
	inputMode?: "text" | "numeric" | "decimal";
	trailing?: ReactNode;
}) {
	const showError = Boolean(error);

	return (
		<Field className="field" invalid={showError}>
			<FieldLabel className="field__label">{label}</FieldLabel>
			<div className="field__row">
				<Input
					className="input"
					type={type}
					value={value}
					onValueChange={onChange}
					onBlur={onBlur}
					placeholder={placeholder}
					autoFocus={autoFocus}
					disabled={disabled}
					min={min}
					inputMode={inputMode}
				/>
				{trailing}
			</div>
			{hint && !showError ? <p className="field__description">{hint}</p> : null}
			{showError ? (
				<FieldError match className="field__error">
					{error}
				</FieldError>
			) : null}
		</Field>
	);
}
