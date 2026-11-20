import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import type { ReactNode } from "react";

import { Select, type SelectOption } from "./Select";

export type { SelectOption };

/**
 * Labelled shadcn-style select for dialog forms. Same Field wiring as TextField, so
 * the label, hint and error are attached to the control for screen readers.
 */
export function SelectField({
	label,
	value,
	onChange,
	onBlur,
	options,
	error,
	hint,
	disabled,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	options: SelectOption[];
	error?: string;
	hint?: ReactNode;
	disabled?: boolean;
}) {
	const showError = Boolean(error);

	return (
		<Field className="field" invalid={showError}>
			<FieldLabel className="field__label">{label}</FieldLabel>
			<Select
				value={value}
				onChange={onChange}
				onBlur={onBlur}
				options={options}
				disabled={disabled}
				invalid={showError}
				aria-label={label}
			/>
			{hint && !showError ? <p className="field__description">{hint}</p> : null}
			{showError ? (
				<FieldError match className="field__error">
					{error}
				</FieldError>
			) : null}
		</Field>
	);
}
