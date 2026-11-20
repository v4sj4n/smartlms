import type { ScheduleSession } from "../../api";

/**
 * Week maths for the timetable, kept in the browser's local time zone.
 *
 * Two facts shape everything here: the API takes plain calendar days
 * ("YYYY-MM-DD") for its window, and a lecture's instant is shown on the day it
 * happens where the reader is. So the Monday the grid draws and the column a
 * session lands in are both local, and a day key is built from local date parts
 * rather than from `toISOString()`, which would slip a day east of UTC.
 */

/** Monday-first index of a date: Mon = 0 … Sun = 6. */
function mondayIndex(date: Date): number {
	return (date.getDay() + 6) % 7;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** "2026-11-23" — the wire format of a schedule bound. */
export function dayKey(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a "YYYY-MM-DD" key; an invalid key stays invalid. */
export function parseDayKey(key: string): Date {
	const [year, month, day] = key.split("-").map(Number);
	if (!year || !month || !day) return new Date(Number.NaN);
	return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
}

/** Local midnight of the Monday the given date falls in. */
export function startOfWeek(date: Date): Date {
	const midnight = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
	);
	return addDays(midnight, -mondayIndex(midnight));
}

export type WeekDay = {
	/** Local midnight. */
	date: Date;
	/** "2026-11-23" — also the key sessions are grouped under. */
	key: string;
	/** "Mon" … "Sun". */
	weekday: string;
	/** "23". */
	dayNumber: string;
	/** "Monday, 23 November 2026" for the column's accessible name. */
	label: string;
	isWeekend: boolean;
	isToday: boolean;
};

const weekdayFormatter = new Intl.DateTimeFormat(undefined, {
	weekday: "short",
});
const dayNumberFormatter = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
});
const fullDayFormatter = new Intl.DateTimeFormat(undefined, {
	weekday: "long",
	day: "numeric",
	month: "long",
	year: "numeric",
});

/** The seven columns of the week that begins on `monday`. */
export function weekDays(monday: Date, today: Date = new Date()): WeekDay[] {
	const todayKey = dayKey(today);
	return Array.from({ length: 7 }, (_, index) => {
		const date = addDays(monday, index);
		const key = dayKey(date);
		return {
			date,
			key,
			weekday: weekdayFormatter.format(date),
			dayNumber: dayNumberFormatter.format(date),
			label: fullDayFormatter.format(date),
			// Seed data has Saturday lectures, so the weekend is only quieter
			// on the page, never hidden.
			isWeekend: index >= 5,
			isToday: key === todayKey,
		};
	});
}

const weekLabelFormatter = new Intl.DateTimeFormat(undefined, {
	month: "short",
	day: "numeric",
	year: "numeric",
});

/**
 * "Nov 23 – 29, 2026" in the reader's locale. A week that straddles a month or a
 * year boundary is formatted by Intl as a range, which names both ends.
 */
export function weekLabel(monday: Date): string {
	const sunday = addDays(monday, 6);
	return weekLabelFormatter.formatRange(monday, sunday);
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
	numeric: "auto",
});

const WEEK_MS = 7 * 86_400_000;

/** "This week" / "Next week" / "In 3 weeks" / "2 weeks ago" for the week bar. */
export function weekOffsetLabel(
	monday: Date,
	today: Date = new Date(),
): string {
	// Rounded, not floored: a DST change leaves the gap an hour off a full week.
	const weeks = Math.round(
		(monday.getTime() - startOfWeek(today).getTime()) / WEEK_MS,
	);
	const text = relativeFormatter.format(weeks, "week");
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Sessions bucketed by the local day they start on, each bucket in start order.
 * A timestamp the browser cannot read is dropped rather than piled onto a
 * made-up day.
 */
export function groupByDay(
	sessions: ScheduleSession[],
): Map<string, ScheduleSession[]> {
	const grouped = new Map<string, ScheduleSession[]>();
	for (const session of sessions) {
		const start = new Date(session.starts_at);
		if (Number.isNaN(start.getTime())) continue;
		const key = dayKey(start);
		const bucket = grouped.get(key);
		if (bucket) bucket.push(session);
		else grouped.set(key, [session]);
	}
	for (const bucket of grouped.values()) {
		bucket.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
	}
	return grouped;
}
