import { ChartBar, ClipboardText } from "@phosphor-icons/react";
import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { type Assignment, api, errorMessage, type Subject } from "../../api";
import { useSession } from "../../auth";
import { formatDateTime, formatRelative } from "../../format";
import { queryKeys, useSubjects } from "../../queries";
import {
	Badge,
	Card,
	EmptyState,
	ErrorState,
	SegmentedFilter,
	SkeletonStack,
	Table,
	Td,
	Th,
} from "../ui";

/** Staff overviews open at most this many subjects (one request each). */
const SUBJECT_LIMIT = 50;

function useAllSubjects() {
	return useSubjects({ page: 1, page_size: SUBJECT_LIMIT });
}

type Row = Assignment & { subject: Subject };
type When = "upcoming" | "past" | "all";

function dueLabel(assignment: Assignment, now: number) {
	if (!assignment.due_at)
		return <span className="table__secondary">No deadline</span>;
	const due = Date.parse(assignment.due_at);
	return (
		<>
			<span className="table__primary num">
				{formatDateTime(assignment.due_at)}
			</span>
			<span
				className={
					due < now ? "table__secondary text-danger" : "table__secondary"
				}
			>
				{due < now ? "Closed " : "Due "}
				{formatRelative(assignment.due_at, now)}
			</span>
		</>
	);
}

/**
 * Every assignment across the subjects staff can see, earliest deadline first.
 * Grading still happens on the assignment page; this is the queue.
 */
export function StaffAssignments() {
	const subjects = useAllSubjects();
	const items = subjects.data?.items ?? [];
	const details = useQueries({
		queries: items.map((subject) => ({
			queryKey: queryKeys.subject(subject.id),
			queryFn: () => api.subject(subject.id),
			staleTime: 15_000,
		})),
	});
	const [when, setWhen] = useState<When>("upcoming");
	const now = Date.now();

	const rows = useMemo<Row[]>(() => {
		const all = details.flatMap((query, index) =>
			(query.data?.assignments ?? []).map((assignment) => ({
				...assignment,
				subject: items[index],
			})),
		);
		return all
			.filter((row) => {
				if (when === "all") return true;
				const due = row.due_at
					? Date.parse(row.due_at)
					: Number.POSITIVE_INFINITY;
				return when === "upcoming" ? due >= now : due < now;
			})
			.sort((left, right) => {
				const a = left.due_at
					? Date.parse(left.due_at)
					: Number.POSITIVE_INFINITY;
				const b = right.due_at
					? Date.parse(right.due_at)
					: Number.POSITIVE_INFINITY;
				return when === "past" ? b - a : a - b;
			});
		// `now` changes every render; the filter only needs to be as fresh as the data.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [details.map((query) => query.dataUpdatedAt).join(), when, items]);

	const loading =
		subjects.isPending || details.some((query) => query.isPending);

	return (
		<Card className="card--flush">
			<div className="list-toolbar">
				<SegmentedFilter
					label="Show assignments"
					value={when}
					onChange={setWhen}
					options={[
						{ value: "upcoming", label: "Upcoming" },
						{ value: "past", label: "Past" },
						{ value: "all", label: "All" },
					]}
				/>
			</div>
			{subjects.isError ? (
				<ErrorState
					title="Assignments could not be loaded"
					message={errorMessage(subjects.error)}
					onRetry={() => void subjects.refetch()}
				/>
			) : loading ? (
				<SkeletonStack rows={5} />
			) : rows.length === 0 ? (
				<EmptyState
					icon={ClipboardText}
					title={when === "past" ? "No past assignments" : "No assignments due"}
					description="Assignments are created on each subject's Assignments tab."
					action={
						<Link to="/subjects" className="btn btn--secondary btn--sm">
							Browse subjects
						</Link>
					}
				/>
			) : (
				<Table caption="Assignments across all subjects">
					<thead>
						<tr>
							<Th>Assignment</Th>
							<Th>Due</Th>
							<Th>Room</Th>
							<Th align="right">Points</Th>
							<Th>Status</Th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr key={row.id}>
								<Td>
									<Link
										to="/assignments/$assignmentId"
										params={{ assignmentId: row.id }}
										className="table__primary table__link"
									>
										{row.title}
									</Link>
									<span className="table__secondary">{row.subject.name}</span>
								</Td>
								<Td>{dueLabel(row, now)}</Td>
								<Td>
									{row.class_name ?? (
										<span className="table__secondary">—</span>
									)}
								</Td>
								<Td align="right">
									<span className="num">{row.max_points}</span>
								</Td>
								<Td>
									{!row.is_published ? (
										<Badge tone="outline">Draft</Badge>
									) : row.due_at && Date.parse(row.due_at) < now ? (
										<Badge>Closed</Badge>
									) : (
										<Badge tone="success">Open</Badge>
									)}
								</Td>
							</tr>
						))}
					</tbody>
				</Table>
			)}
		</Card>
	);
}

/**
 * One row per subject: how many students, how much of the gradebook is filled
 * in, the average so far and how many are passing.
 */
export function StaffGradesOverview() {
	const session = useSession();
	const subjects = useAllSubjects();
	const items = subjects.data?.items ?? [];
	const gradebooks = useQueries({
		queries: items.map((subject) => ({
			queryKey: queryKeys.gradebook(subject.id),
			queryFn: () => api.gradebook(subject.id),
			staleTime: 10_000,
		})),
	});

	if (subjects.isError) {
		return (
			<Card>
				<ErrorState
					title="Subjects could not be loaded"
					message={errorMessage(subjects.error)}
					onRetry={() => void subjects.refetch()}
				/>
			</Card>
		);
	}
	if (subjects.isPending) {
		return (
			<Card>
				<SkeletonStack rows={5} />
			</Card>
		);
	}
	if (items.length === 0) {
		return (
			<Card>
				<EmptyState
					icon={ChartBar}
					title="No subjects yet"
					description="Gradebooks appear here once subjects exist."
				/>
			</Card>
		);
	}

	return (
		<Card className="card--flush">
			<Table caption="Gradebook summary per subject">
				<thead>
					<tr>
						<Th>Subject</Th>
						<Th align="right">Students</Th>
						<Th>Graded</Th>
						<Th align="right">Average</Th>
						<Th align="right">Passing</Th>
					</tr>
				</thead>
				<tbody>
					{items.map((subject, index) => {
						const query = gradebooks[index];
						const book = query?.data;
						const students = book?.students ?? [];
						const totals = students
							.map((student) => student.total_points)
							.filter((value): value is number => value !== null);
						const average = totals.length
							? totals.reduce((sum, value) => sum + value, 0) / totals.length
							: null;
						// Backend coverage is 0-1; shown as a percentage.
						const coverage = students.length
							? (students.reduce((sum, student) => sum + student.coverage, 0) /
									students.length) *
								100
							: 0;
						const passing = students.filter(
							(student) => student.is_passing,
						).length;
						return (
							<tr key={subject.id}>
								<Td>
									<Link
										to="/subjects/$subjectId"
										params={{ subjectId: subject.id }}
										className="table__primary table__link"
									>
										{subject.name}
									</Link>
									<span className="table__secondary">
										{[subject.code, subject.lecturer_name]
											.filter(Boolean)
											.join(" · ")}
									</span>
								</Td>
								{query?.isPending ? (
									<Td colSpan={4}>
										<span className="table__secondary">Loading gradebook…</span>
									</Td>
								) : query?.isError ? (
									<Td colSpan={4}>
										<span className="table__secondary">
											Gradebook unavailable
										</span>
									</Td>
								) : (
									<>
										<Td align="right">
											<span className="num">{students.length}</span>
										</Td>
										<Td>
											{book && book.components.length > 0 ? (
												<span
													className="cov"
													title={`${Math.round(coverage)}% of the weight graded`}
												>
													<span className="cov__track" aria-hidden="true">
														<span
															className="cov__fill"
															style={{
																width: `${Math.min(100, Math.max(0, coverage))}%`,
															}}
														/>
													</span>
													<span className="cov__value num">
														{Math.round(coverage)}%
													</span>
												</span>
											) : (
												<span className="table__secondary">No components</span>
											)}
										</Td>
										<Td align="right">
											<span className="num">
												{average === null ? "—" : average.toFixed(1)}
											</span>
										</Td>
										<Td align="right">
											<span className="num">
												{students.length
													? `${passing} / ${students.length}`
													: "—"}
											</span>
										</Td>
									</>
								)}
							</tr>
						);
					})}
				</tbody>
			</Table>
		</Card>
	);
}
