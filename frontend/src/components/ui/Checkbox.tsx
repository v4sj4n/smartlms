import { Check, Minus } from "@phosphor-icons/react";
import {
	CheckboxIndicator,
	Checkbox as CheckboxRoot,
} from "@ui-sdk/react/checkbox";
import type { ReactNode } from "react";

/** Checkbox with optional label; `indeterminate` shows a dash. */
export function Checkbox({
	checked,
	onChange,
	label,
	indeterminate,
	disabled,
	"aria-label": ariaLabel,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label?: ReactNode;
	indeterminate?: boolean;
	disabled?: boolean;
	"aria-label"?: string;
}) {
	const box = (
		<CheckboxRoot
			className="checkbox"
			checked={indeterminate ? "indeterminate" : checked}
			onCheckedChange={(next) => onChange(next === true)}
			disabled={disabled}
			aria-label={label ? undefined : ariaLabel}
		>
			<CheckboxIndicator className="checkbox__indicator">
				{indeterminate ? (
					<Minus size={12} weight="bold" aria-hidden="true" />
				) : (
					<Check size={12} weight="bold" aria-hidden="true" />
				)}
			</CheckboxIndicator>
		</CheckboxRoot>
	);
	return label ? (
		<label className="checkbox-label">
			{box}
			<span>{label}</span>
		</label>
	) : (
		box
	);
}
