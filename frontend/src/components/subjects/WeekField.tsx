import type { CourseWeek, WeekSeason } from "../../api";
import { formatDate } from "../../format";
import { useWeeks } from "../../queries";
import { SelectField } from "../ui";

export const SEASON_LABEL: Record<WeekSeason, string> = {
	FALL: "Fall",
	SUMMER: "Summer",
};

/** "23 Nov 2026 – 29 Nov 2026", or "No dates set". */
export function weekRange(week: CourseWeek): string {
	if (!week.starts_on && !week.ends_on) return "No dates set";
	const start = week.starts_on ? formatDate(week.starts_on) : "—";
	const end = week.ends_on ? formatDate(week.ends_on) : "—";
	return `${start} – ${end}`;
}

/** "Week 3 · Fall · 7 Dec 2026 – 13 Dec 2026". */
export function weekLabel(week: CourseWeek): string {
	return `Week ${week.week_number} · ${SEASON_LABEL[week.season]} · ${weekRange(week)}`;
}

/**
 * Picks the week a piece of content is taught in. An empty choice means "not
 * scheduled into a week yet", which is a valid place for a draft.
 */
export function WeekField({
	subjectId,
	value,
	onChange,
	onBlur,
	disabled,
	error,
}: {
	subjectId: string;
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	disabled?: boolean;
	error?: string;
}) {
	const weeks = useWeeks(subjectId);

	const options = [
		{ value: "", label: "No week yet" },
		...(weeks.data?.weeks ?? []).map((week) => ({
			value: week.id,
			label: weekLabel(week),
		})),
	];

	return (
		<SelectField
			label="Week"
			value={value}
			onChange={onChange}
			onBlur={onBlur}
			options={options}
			error={error}
			disabled={disabled || weeks.isPending}
			hint={
				weeks.isPending
					? "Loading the week plan…"
					: weeks.data && weeks.data.weeks.length === 0
						? "This subject has no weeks yet; add them on the Weeks tab."
						: "Which week of the term this is taught in."
			}
		/>
	);
}
