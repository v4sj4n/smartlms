import {
	CalendarDots,
	CaretLeft,
	CaretRight,
	Printer,
} from "@phosphor-icons/react";
import { createRoute } from "@tanstack/react-router";
import { type ReactNode, useMemo, useState } from "react";
import { errorMessage } from "../api";
import { ModuleGate } from "../components/ModuleGate";
import { WeekGrid } from "../components/timetable/WeekGrid";
import {
	addDays,
	dayKey,
	groupByDay,
	startOfWeek,
	weekDays,
	weekLabel,
	weekOffsetLabel,
} from "../components/timetable/week";
import {
	Button,
	Card,
	Chip,
	EmptyState,
	ErrorState,
	IconButton,
	PageHeader,
} from "../components/ui";
import { useSchedule } from "../queries";
import { appLayoutRoute } from "./app-layout";

const plural = (count: number, one: string, many: string) =>
	`${count} ${count === 1 ? one : many}`;

/** Left/right week buttons, the week's name, and how far it is from today. */
function WeekBar({
	weekStart,
	onShift,
	sessionCount,
}: {
	/** Monday of the week on screen. */
	weekStart: Date;
	onShift: (weeks: number) => void;
	sessionCount: number;
}) {
	return (
		<div className="tt-toolbar">
			<div className="tt-toolbar__nav">
				<IconButton
					label="Previous week"
					icon={<CaretLeft size={16} weight="bold" aria-hidden="true" />}
					onClick={() => onShift(-1)}
				/>
				<p className="tt-toolbar__label">
					<span className="tt-toolbar__title">{weekLabel(weekStart)}</span>
					<span className="tt-toolbar__hint">{weekOffsetLabel(weekStart)}</span>
				</p>
				<IconButton
					label="Next week"
					icon={<CaretRight size={16} weight="bold" aria-hidden="true" />}
					onClick={() => onShift(1)}
				/>
			</div>
			{/* No chip on an empty week: a zero is not information. */}
			{sessionCount > 0 ? (
				<Chip tone="muted">{plural(sessionCount, "lecture", "lectures")}</Chip>
			) : null}
		</div>
	);
}

/**
 * The caller's lectures, one Monday-to-Sunday week at a time. The window is the
 * seven local days of the displayed week; prev/next move the whole window.
 */
function TimetablePage() {
	const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

	const days = useMemo(() => weekDays(weekStart), [weekStart]);
	const schedule = useSchedule(days[0].key, days[6].key);

	const sessionsByDay = useMemo(
		() => groupByDay(schedule.data?.sessions ?? []),
		[schedule.data],
	);
	// Counted from the grid's own buckets, so the chip and the empty state can
	// never disagree with what is on screen.
	const sessionCount = useMemo(
		() =>
			[...sessionsByDay.values()].reduce(
				(total, list) => total + list.length,
				0,
			),
		[sessionsByDay],
	);

	const currentWeek = startOfWeek(new Date());
	const isCurrentWeek = dayKey(weekStart) === dayKey(currentWeek);

	const shiftWeek = (weeks: number) =>
		setWeekStart((start) => addDays(start, weeks * 7));

	let content: ReactNode;
	if (schedule.isPending) {
		content = (
			<Card>
				<WeekGrid days={days} sessionsByDay={sessionsByDay} loading />
			</Card>
		);
	} else if (schedule.isError) {
		content = (
			<Card>
				<ErrorState
					title="Timetable could not be loaded"
					message={errorMessage(schedule.error)}
					onRetry={() => void schedule.refetch()}
				/>
			</Card>
		);
	} else if (sessionCount === 0) {
		content = (
			<Card>
				<EmptyState
					icon={CalendarDots}
					title={`No lectures ${weekLabel(weekStart)}`}
					description="Nothing is scheduled between these dates. A nearby week may hold your classes."
					action={
						<div className="row">
							<Button
								size="sm"
								variant="secondary"
								icon={<CaretLeft size={14} weight="bold" aria-hidden="true" />}
								onClick={() => shiftWeek(-1)}
							>
								Previous week
							</Button>
							<Button
								size="sm"
								variant="secondary"
								iconAfter={
									<CaretRight size={14} weight="bold" aria-hidden="true" />
								}
								onClick={() => shiftWeek(1)}
							>
								Next week
							</Button>
						</div>
					}
				/>
			</Card>
		);
	} else {
		content = (
			<Card>
				<WeekGrid days={days} sessionsByDay={sessionsByDay} />
			</Card>
		);
	}

	return (
		<ModuleGate moduleKey="timetable">
			<PageHeader
				title="Timetable"
				description="Your lectures, week by week, with room and lecturer."
				actions={
					<>
						{isCurrentWeek ? null : (
							<Button
								size="sm"
								variant="secondary"
								onClick={() => setWeekStart(startOfWeek(new Date()))}
							>
								This week
							</Button>
						)}
						<Button
							size="sm"
							variant="secondary"
							icon={<Printer size={15} weight="regular" aria-hidden="true" />}
							onClick={() => window.print()}
						>
							Print
						</Button>
					</>
				}
			/>
			<WeekBar
				weekStart={weekStart}
				onShift={shiftWeek}
				sessionCount={sessionCount}
			/>
			{content}
		</ModuleGate>
	);
}

export const timetableRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/timetable",
	component: TimetablePage,
});
