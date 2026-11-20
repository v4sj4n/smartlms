import {
	ProgressIndicator,
	ProgressLabel,
	Progress as ProgressRoot,
	ProgressTrack,
	ProgressValue,
} from "@ui-sdk/react/progress";

/** Labelled progress bar, e.g. course completion. `value` is 0–100. */
export function Progress({
	value,
	label,
	showValue = true,
}: {
	value: number;
	label: string;
	showValue?: boolean;
}) {
	return (
		<ProgressRoot className="progress" value={value}>
			<div className="progress__head">
				<ProgressLabel className="progress__label">{label}</ProgressLabel>
				{showValue ? <ProgressValue className="progress__value" /> : null}
			</div>
			<ProgressTrack className="progress__track">
				<ProgressIndicator className="progress__indicator" />
			</ProgressTrack>
		</ProgressRoot>
	);
}
