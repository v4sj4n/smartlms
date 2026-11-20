import { SealCheck } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { RecordEntry } from "../../api";
import { GradeStatusBadge } from "../subjects/SubjectGradeView";
import { Badge, Card, EmptyState, Table, Td, Th } from "../ui";
import { type SemesterGroup, summariseYear, type YearGroup } from "./history";

/** One number of a year's summary: label above, value below. */
function Metric({
	label,
	value,
	foot,
}: {
	label: string;
	value: ReactNode;
	foot?: ReactNode;
}) {
	return (
		<div>
			<p className="metric__label">{label}</p>
			<p className="metric__value num">
				{value}
				{foot ? <span className="metric__foot">{foot}</span> : null}
			</p>
		</div>
	);
}

/**
 * The table of one semester. The year is already named by the card above it, so
 * the title stays on the semester alone.
 */
function SemesterCard({
	semester,
	passGrade,
}: {
	semester: SemesterGroup;
	passGrade: number;
}) {
	return (
		<Card className="card--flush">
			<div className="gradebook__toolbar">
				<h2 className="card__title">{semester.label}</h2>
				<span className="card__hint num">{semester.ects} ECTS</span>
			</div>
			<Table caption={`${semester.label} subjects`}>
				<thead>
					<tr>
						<Th>Subject</Th>
						<Th align="right">ECTS</Th>
						<Th align="right">Points</Th>
						<Th align="right">Grade</Th>
						<Th>Status</Th>
						<Th>Sitting</Th>
					</tr>
				</thead>
				<tbody>
					{semester.entries.map((entry: RecordEntry) => (
						<tr key={`${entry.subject_id}-${entry.attempt_no}`}>
							<Td>
								<div className="record-subject">
									<span className="table__primary">{entry.subject_name}</span>
									{entry.is_official ? (
										<span className="table__secondary">
											<Badge tone="success">official</Badge>
											{entry.override_note ? ` ${entry.override_note}` : null}
										</span>
									) : entry.is_overridden ? (
										<span className="table__secondary">
											exam office override
										</span>
									) : null}
								</div>
							</Td>
							<Td align="right">
								<span className="num">{entry.ects ?? "—"}</span>
							</Td>
							<Td align="right">
								<span className="num">
									{entry.total_points === null
										? "—"
										: entry.total_points.toFixed(2)}
								</span>
							</Td>
							<Td align="right">
								<span className="num">{entry.grade ?? "—"}</span>
							</Td>
							<Td>
								<GradeStatusBadge status={entry.status} passGrade={passGrade} />
							</Td>
							<Td>
								<span className="num">#{entry.attempt_no}</span>
							</Td>
						</tr>
					))}
				</tbody>
			</Table>
		</Card>
	);
}

/**
 * A whole school year of the study record: its own credits, GPA and pass counts
 * computed from that year's entries, then the semester tables below. Each year
 * is self-contained so a tab shows exactly what a printed page shows.
 */
export function RecordYear({
	year,
	passGrade,
	title,
}: {
	year: YearGroup;
	passGrade: number;
	/**
	 * What the summary card is called. The year by default, so a printed page
	 * names the year it covers; a single-year record already says the year in the
	 * page header, so it passes a plain title instead of repeating it.
	 */
	title?: string;
}) {
	const summary = summariseYear(year.entries);
	const subjectCount = year.entries.length;

	return (
		<>
			<Card>
				<div className="gradebook__toolbar">
					<h2 className="card__title">{title ?? year.label}</h2>
					<span className="card__hint num">
						{subjectCount} {subjectCount === 1 ? "subject" : "subjects"} ·{" "}
						{year.ects} ECTS
					</span>
				</div>
				<div className="grade-summary">
					<Metric
						label="GPA"
						value={summary.gpa === null ? "–" : summary.gpa.toFixed(2)}
						foot=" / 10"
					/>
					<Metric label="Credits earned" value={summary.creditsEarned} />
					<Metric label="Credits in flight" value={summary.creditsInFlight} />
					<Metric label="Subjects passed" value={summary.subjectsPassed} />
					<Metric label="Subjects failed" value={summary.subjectsFailed} />
					{summary.withdrawn > 0 ? (
						<Metric label="Withdrawn" value={summary.withdrawn} />
					) : null}
				</div>
				<p className="card__hint">
					GPA is the ECTS-weighted average of the 4–10 grades of the subjects
					passed in this school year. Pass mark: {passGrade}.
				</p>
			</Card>

			{subjectCount === 0 ? (
				<Card>
					<EmptyState
						icon={SealCheck}
						title="No record entries for this year"
						description="A subject appears here once this school year has an enrollment and the gradebook has points."
					/>
				</Card>
			) : (
				year.semesters.map((semester) => (
					<SemesterCard
						key={semester.key}
						semester={semester}
						passGrade={passGrade}
					/>
				))
			)}
		</>
	);
}
