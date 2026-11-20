import type { RecordEntry } from "../../api";

/**
 * The study record is one flat list of entries; the page reads it as a history.
 * Everything here is derived from that list alone, so a year's numbers can be
 * recomputed without asking the backend for a per-year record endpoint.
 */

/** School years that exist in the list, newest first, unknown year last. */
export const UNKNOWN_YEAR_KEY = "__unknown__";

/** What a year is called when its subjects carry none. */
export const UNKNOWN_YEAR_LABEL = "Year not recorded";

/** One semester inside a year: the entries and their ECTS total. */
export type SemesterGroup = {
	key: string;
	label: string;
	entries: RecordEntry[];
	ects: number;
};

/** One school year of the record, ready to render. */
export type YearGroup = {
	/** Stable tab value: the year name, or {@link UNKNOWN_YEAR_KEY}. */
	key: string;
	/** Display label: "2026/2027" or "Year not recorded". */
	label: string;
	/** The raw `school_year`, empty when the entries carry none. */
	schoolYear: string;
	entries: RecordEntry[];
	/** Semesters present in this year, newest first. */
	semesters: SemesterGroup[];
	ects: number;
};

/**
 * A year's totals, computed the way the backend summarises the whole card:
 * a passed subject adds its ECTS and, when it has a grade and credits, feeds
 * the ECTS-weighted GPA; a failed subject is counted only; a subject still in
 * progress adds its ECTS to the credits in flight; a withdrawn one is on the
 * list but in no total. So the numbers for the only year always agree with the
 * record-wide ones the API returns.
 */
export type YearSummary = {
	gpa: number | null;
	creditsEarned: number;
	creditsInFlight: number;
	subjectsPassed: number;
	subjectsFailed: number;
	/** On the card, counted in no total. Surfaced only when non-zero. */
	withdrawn: number;
};

function round(value: number, digits: number): number {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

function yearLabel(schoolYear: string): string {
	const trimmed = schoolYear.trim();
	return trimmed === "" ? UNKNOWN_YEAR_LABEL : trimmed;
}

function semesterLabel(semester: string | undefined): string {
	switch (semester) {
		case "FIRST":
			return "Semester I";
		case "SECOND":
			return "Semester II";
		default:
			return "Semester not recorded";
	}
}

function ectsOf(entries: RecordEntry[]): number {
	return round(
		entries.reduce((total, entry) => total + (entry.ects ?? 0), 0),
		1,
	);
}

/** Groups the flat entry list into years (newest first) and semesters within. */
export function groupBySchoolYear(entries: RecordEntry[]): YearGroup[] {
	const years = new Map<string, YearGroup>();
	const semesters = new Map<string, Map<string, SemesterGroup>>();

	for (const entry of entries) {
		const schoolYear = (entry.school_year ?? "").trim();
		const key = schoolYear === "" ? UNKNOWN_YEAR_KEY : schoolYear;

		let year = years.get(key);
		if (!year) {
			year = {
				key,
				label: yearLabel(schoolYear),
				schoolYear,
				entries: [],
				semesters: [],
				ects: 0,
			};
			years.set(key, year);
			semesters.set(key, new Map());
		}
		year.entries.push(entry);

		const semesterKey = entry.semester ?? "";
		const bySemester = semesters.get(key);
		if (!bySemester) continue;
		const semester = bySemester.get(semesterKey) ?? {
			key: semesterKey,
			label: semesterLabel(entry.semester),
			entries: [],
			ects: 0,
		};
		semester.entries.push(entry);
		bySemester.set(semesterKey, semester);
	}

	for (const year of years.values()) {
		year.ects = ectsOf(year.entries);
		year.semesters = [...(semesters.get(year.key)?.values() ?? [])].sort(
			(left, right) => right.key.localeCompare(left.key),
		);
		for (const semester of year.semesters) {
			semester.ects = ectsOf(semester.entries);
		}
	}

	return [...years.values()].sort((left, right) => {
		// Entries with no year sit at the end: they are not "older", just unknown.
		if (left.key === UNKNOWN_YEAR_KEY) return 1;
		if (right.key === UNKNOWN_YEAR_KEY) return -1;
		return right.key.localeCompare(left.key, undefined, { numeric: true });
	});
}

/** The totals for one year, from that year's entries only. */
export function summariseYear(entries: RecordEntry[]): YearSummary {
	let weighted = 0;
	let weight = 0;
	let creditsEarned = 0;
	let creditsInFlight = 0;
	let subjectsPassed = 0;
	let subjectsFailed = 0;
	let withdrawn = 0;

	for (const entry of entries) {
		const credits = entry.ects ?? 0;
		switch (entry.status) {
			case "passed":
				subjectsPassed += 1;
				creditsEarned += credits;
				if (entry.grade !== null && credits > 0) {
					weighted += entry.grade * credits;
					weight += credits;
				}
				break;
			case "failed":
				subjectsFailed += 1;
				break;
			case "in_progress":
				creditsInFlight += credits;
				break;
			default:
				withdrawn += 1;
		}
	}

	return {
		gpa: weight > 0 ? round(weighted / weight, 2) : null,
		creditsEarned: round(creditsEarned, 1),
		creditsInFlight: round(creditsInFlight, 1),
		subjectsPassed,
		subjectsFailed,
		withdrawn,
	};
}
