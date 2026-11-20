import { Switch as SwitchRoot, SwitchThumb } from "@ui-sdk/react/switch";

/** Pill switch on ui-sdk Switch. Same API as before; styles key off data-checked. */
export function Switch({
	checked,
	onChange,
	label,
	disabled,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: string;
	disabled?: boolean;
}) {
	return (
		<SwitchRoot
			className="switch"
			checked={checked}
			onCheckedChange={(next) => onChange(next === true)}
			aria-label={label}
			disabled={disabled}
		>
			<SwitchThumb className="switch__thumb" />
		</SwitchRoot>
	);
}
