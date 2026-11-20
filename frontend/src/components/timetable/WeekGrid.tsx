import type { ScheduleSession } from "../../api";
import { Skeleton } from "../ui";
import { SessionCard } from "./SessionCard";
import type { WeekDay } from "./week";

/** Placeholder cards while the week is in flight: the grid keeps its shape. */
function DaySkeleton() {
	return (
		<>
			{Array.from({ length: 2 }, (_, index) => (
				<div key={index} className="tt-session tt-session--skeleton">
					<Skeleton width="44%" />
					<Skeleton />
					<Skeleton width="70%" />
				</div>
			))}
		</>
	);
}

function DayColumn({
	day,
	sessions,
	loading,
}: {
	day: WeekDay;
	sessions: ScheduleSession[];
	loading: boolean;
}) {
	const classes = [
		"tt-day",
		day.isWeekend ? "tt-day--weekend" : "",
		day.isToday ? "tt-day--today" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<article className={classes} aria-label={day.label}>
			<header className="tt-day__head">
				<span className="tt-day__weekday">{day.weekday}</span>
				<span className="tt-day__date">{day.dayNumber}</span>
			</header>
			<div className="tt-day__body">
				{loading ? (
					<DaySkeleton />
				) : sessions.length === 0 ? (
					// A free day is normal, not a zero: one quiet line, no badge.
					<p className="tt-day__empty">No classes</p>
				) : (
					sessions.map((session) => (
						<SessionCard key={session.id} session={session} />
					))
				)}
			</div>
		</article>
	);
}

/**
 * Monday-to-Sunday columns, each a vertical list in start order. Deliberately
 * not an hour grid: a list never breaks on a missing, odd or overlapping time,
 * and it stays readable when a column is a few hundred pixels wide.
 */
export function WeekGrid({
	days,
	sessionsByDay,
	loading = false,
}: {
	days: WeekDay[];
	sessionsByDay: Map<string, ScheduleSession[]>;
	loading?: boolean;
}) {
	return (
		<div className="timetable">
			<div className="timetable__grid">
				{days.map((day) => (
					<DayColumn
						key={day.key}
						day={day}
						sessions={sessionsByDay.get(day.key) ?? []}
						loading={loading}
					/>
				))}
			</div>
		</div>
	);
}
