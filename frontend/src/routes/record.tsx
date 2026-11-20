import { ArrowLeft, Printer, SealCheck } from "@phosphor-icons/react";
import { createRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { errorMessage, type RecordEntry } from "../api";
import { useAuth } from "../auth";
import { ModuleGate } from "../components/ModuleGate";
import { GradeStatusBadge } from "../components/subjects/SubjectGradeView";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	ErrorState,
	PageHeader,
	SkeletonStack,
	Table,
	Td,
	Th,
} from "../components/ui";
import { StudentDirectory } from "../components/users/StudentDirectory";
import { useStudentRecord } from "../queries";
import { appLayoutRoute } from "./app-layout";

type Group = { key: string; label: string; entries: RecordEntry[] };

function groupEntries(entries: RecordEntry[]): Group[] {
	const groups = new Map<string, Group>();

	for (const entry of entries) {
		const key = `${entry.school_year ?? "—"}·${entry.semester ?? "—"}`;
		const label = `${entry.school_year ?? "No academic year"} · ${
			entry.semester === "SECOND" ? "Semester II" : "Semester I"
		}`;
		const group = groups.get(key) ?? { key, label, entries: [] };
		group.entries.push(entry);
		groups.set(key, group);
	}

	return [...groups.values()].sort((left, right) =>
		right.key.localeCompare(left.key),
	);
}

/** `?student=<id>&name=<display name>`: which student staff are looking at. */
type RecordSearch = { student?: string; name?: string };

function parseRecordSearch(search: Record<string, unknown>): RecordSearch {
	const parsed: RecordSearch = {};
	if (typeof search.student === "string" && search.student)
		parsed.student = search.student;
	if (parsed.student && typeof search.name === "string" && search.name)
		parsed.name = search.name;
	return parsed;
}

function RecordContent() {
	const { session } = useAuth();
	const search = recordRoute.useSearch();
	const isStudent = session?.user.role === "STUDENT";
	// Students always see their own card; staff pick a student first.
	const studentId = isStudent ? session?.user.id : search.student;
	const record = useStudentRecord(studentId);

	const groups = useMemo(
		() => groupEntries(record.data?.entries ?? []),
		[record.data],
	);

	if (!studentId) {
		return (
			<>
				<PageHeader
					title="Study record"
					description="Pick a student to see their credits, grades and GPA."
				/>
				<StudentDirectory />
			</>
		);
	}

	return (
		<>
			{isStudent ? null : (
				<Link to="/record" className="back-link">
					<ArrowLeft size={14} weight="bold" aria-hidden="true" />
					All students
				</Link>
			)}
			<PageHeader
				title={isStudent ? "Study record" : (search.name ?? "Study record")}
				description={
					isStudent
						? "Credits, grades and GPA for every subject you are enrolled in."
						: "Credits, grades and GPA across this student's subjects."
				}
				actions={
					<Button
						variant="secondary"
						size="sm"
						icon={<Printer size={15} weight="regular" aria-hidden="true" />}
						onClick={() => window.print()}
					>
						Print
					</Button>
				}
			/>

			{record.isPending ? (
				<Card>
					<SkeletonStack rows={7} />
				</Card>
			) : record.isError ? (
				<Card>
					<ErrorState
						title="Record could not be loaded"
						message={errorMessage(record.error)}
						onRetry={() => void record.refetch()}
					/>
				</Card>
			) : (
				<>
					<Card>
						<div className="grade-summary">
							<div>
								<p className="metric__label">GPA</p>
								<p className="metric__value num">
									{record.data.gpa === null ? "–" : record.data.gpa.toFixed(2)}
									<span className="metric__foot"> / 10</span>
								</p>
							</div>
							<div>
								<p className="metric__label">Credits earned</p>
								<p className="metric__value num">
									{record.data.credits_earned}
								</p>
							</div>
							<div>
								<p className="metric__label">Credits in flight</p>
								<p className="metric__value num">
									{record.data.credits_in_flight}
								</p>
							</div>
							<div>
								<p className="metric__label">Subjects passed</p>
								<p className="metric__value num">
									{record.data.subjects_passed}
								</p>
							</div>
							<div>
								<p className="metric__label">Subjects failed</p>
								<p className="metric__value num">
									{record.data.subjects_failed}
								</p>
							</div>
						</div>
						<p className="card__hint">
							GPA is the ECTS-weighted average of the 4-10 grades of passed
							subjects. Pass mark: {record.data.pass_grade}.
						</p>
					</Card>

					{groups.length === 0 ? (
						<Card>
							<EmptyState
								icon={SealCheck}
								title="Nothing on the record yet"
								description="Subjects appear once there is an enrollment and the gradebook has points."
							/>
						</Card>
					) : (
						groups.map((group) => (
							<Card key={group.key} className="card--flush">
								<div className="gradebook__toolbar">
									<h2 className="card__title">{group.label}</h2>
									<span className="card__hint num">
										{group.entries.reduce(
											(sum, entry) => sum + (entry.ects ?? 0),
											0,
										)}{" "}
										ECTS
									</span>
								</div>
								<Table caption={group.label}>
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
										{group.entries.map((entry) => (
											<tr key={`${entry.subject_id}-${entry.attempt_no}`}>
												<Td>
													<span className="table__primary">
														{entry.subject_name}
													</span>
													{entry.is_official ? (
														<span className="table__secondary">
															<Badge tone="success">official</Badge>
															{entry.override_note
																? ` ${entry.override_note}`
																: null}
														</span>
													) : entry.is_overridden ? (
														<span className="table__secondary">
															exam office override
														</span>
													) : null}
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
													<GradeStatusBadge
														status={entry.status}
														passGrade={record.data?.pass_grade ?? 5}
													/>
												</Td>
												<Td>
													<span className="num">#{entry.attempt_no}</span>
												</Td>
											</tr>
										))}
									</tbody>
								</Table>
							</Card>
						))
					)}
				</>
			)}
		</>
	);
}

function RecordPage() {
	return (
		<ModuleGate moduleKey="records">
			<RecordContent />
		</ModuleGate>
	);
}

export const recordRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/record",
	validateSearch: parseRecordSearch,
	component: RecordPage,
});
