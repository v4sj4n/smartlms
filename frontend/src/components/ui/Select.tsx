import { CaretUpDown, Check } from "@phosphor-icons/react";
import {
	SelectContent,
	SelectItem,
	SelectItemIndicator,
	SelectItemText,
	Select as SelectRoot,
	SelectTrigger,
	SelectValue,
} from "@ui-sdk/react/select";

export type SelectOption = { value: string; label: string; disabled?: boolean };

/**
 * shadcn-style select: a trigger button and a popover list with a check on the
 * selected item. Replaces the native <select>, whose popup can't be styled.
 */
export function Select({
	value,
	onChange,
	onBlur,
	options,
	placeholder = "Select…",
	disabled,
	invalid,
	compact,
	id,
	"aria-label": ariaLabel,
}: {
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	options: SelectOption[];
	placeholder?: string;
	disabled?: boolean;
	invalid?: boolean;
	compact?: boolean;
	id?: string;
	"aria-label"?: string;
}) {
	const selected = options.find((option) => option.value === value);

	return (
		<SelectRoot<string>
			value={selected ? value : null}
			onValueChange={(next) => onChange(next ?? "")}
			disabled={disabled}
			placeholder={placeholder}
		>
			<SelectTrigger
				id={id}
				className={compact ? "select select--compact" : "select"}
				aria-label={ariaLabel}
				aria-invalid={invalid || undefined}
				onBlur={onBlur}
			>
				<SelectValue className="select__value">
					{selected ? selected.label : placeholder}
				</SelectValue>
				<CaretUpDown className="select__icon" size={14} aria-hidden="true" />
			</SelectTrigger>
			<SelectContent className="select__content" sideOffset={4}>
				{options.map((option) => (
					<SelectItem
						key={option.value}
						value={option.value}
						label={option.label}
						disabled={option.disabled}
						className="select__item"
					>
						<SelectItemText>{option.label}</SelectItemText>
						<SelectItemIndicator className="select__check">
							<Check size={14} weight="bold" aria-hidden="true" />
						</SelectItemIndicator>
					</SelectItem>
				))}
			</SelectContent>
		</SelectRoot>
	);
}
