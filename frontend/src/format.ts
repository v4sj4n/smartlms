const timeFormatter = new Intl.DateTimeFormat(undefined, {
	hour: "2-digit",
	minute: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

/** "15:56" — used for lockout copy: "try again at 15:56". */
export function formatTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return timeFormatter.format(date);
}

/** "20 Nov 2026, 15:56". */
export function formatDateTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return dateTimeFormatter.format(date);
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	day: "numeric",
	month: "short",
	year: "numeric",
});

/**
 * "1 Sep 2026" — a bare calendar date such as a school year boundary. Split
 * from formatDateTime because a date-only string would otherwise be read as UTC
 * midnight and could slip a day in western timezones.
 */
export function formatDate(dateOnly: string): string {
	const date = new Date(`${dateOnly}T00:00:00`);
	if (Number.isNaN(date.getTime())) return dateOnly;
	return dateFormatter.format(date);
}

/** "14:52:09" — local clock time for the last refresh of live data. */
export function formatClock(date: Date): string {
	return new Intl.DateTimeFormat(undefined, {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).format(date);
}

/** "ADMIN" -> "Admin", "students" -> "Students". */
export function humanize(value: string): string {
	const spaced = value.replace(/[_-]+/g, " ").trim();
	if (!spaced) return value;
	return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * Lockout copy: the clock time when the lock ends, plus the date only when the
 * lock runs past today.
 */
export function formatLockoutTime(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const now = new Date();
	const sameDay =
		date.getFullYear() === now.getFullYear() &&
		date.getMonth() === now.getMonth() &&
		date.getDate() === now.getDate();
	return sameDay ? timeFormatter.format(date) : dateTimeFormatter.format(date);
}

/** RFC3339 -> value for <input type="datetime-local"> in local time. */
export function toDateTimeLocal(iso: string | undefined): string {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
		date.getHours(),
	)}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> value -> RFC3339, or "" when empty. */
export function fromDateTimeLocal(value: string): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString();
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
	numeric: "auto",
});

const RELATIVE_STEPS: {
	limit: number;
	unit: Intl.RelativeTimeFormatUnit;
	ms: number;
}[] = [
	{ limit: 60_000, unit: "second", ms: 1000 },
	{ limit: 3_600_000, unit: "minute", ms: 60_000 },
	{ limit: 86_400_000, unit: "hour", ms: 3_600_000 },
	{ limit: 604_800_000, unit: "day", ms: 86_400_000 },
];

/** "3 min ago" / "yesterday" for notification timestamps. */
export function formatRelative(iso: string, now: number = Date.now()): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const delta = date.getTime() - now;
	const magnitude = Math.abs(delta);
	for (const step of RELATIVE_STEPS) {
		if (magnitude < step.limit) {
			return relativeFormatter.format(Math.round(delta / step.ms), step.unit);
		}
	}
	return relativeFormatter.format(Math.round(delta / 2_592_000_000), "month");
}

/** "Ada Lovelace" -> "AL"; one word -> first two letters. */
export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
