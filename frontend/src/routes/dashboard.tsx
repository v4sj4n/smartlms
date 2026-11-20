import {
	Books,
	CalendarBlank,
	CaretRight,
	Chalkboard,
	ClipboardText,
} from "@phosphor-icons/react";
import { useQueries } from "@tanstack/react-query";
import { createRoute, Link } from "@tanstack/react-router";
import { api, errorMessage, type SubjectDetail } from "../api";
import { useAuth, useSession } from "../auth";
import {
	Badge,
	Card,
	CardHeader,
	EmptyState,
	ErrorState,
	PageHeader,
	Skeleton,
	SkeletonStack,
} from "../components/ui";
import {
	queryKeys,
	useHealth,
	useStudentAssignments,
	useStudentRecord,
	useSubjects,
	useUsers,
} from "../queries";
import { appLayoutRoute } from "./app-layout";

/** How many subjects the dashboard opens to collect lectures and deadlines. */
const DETAIL_LIMIT = 8;
const UPCOMING_LIMIT = 6;

const plural = (count: number, one: string, many: string) =>
	`${count} ${count === 1 ? one : many}`;

function greeting(now: Date): string {
	const hour = now.getHours();
	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}

const dayFormatter = new Intl.DateTimeFormat(undefined, {
	weekday: "long",
	day: "numeric",
	month: "long",
});
const shortDayFormatter = new Intl.DateTimeFormat(undefined, {
	weekday: "short",
	day: "numeric",
	month: "short",
});
const timeFormatter = new Intl.DateTimeFormat(undefined, {
	hour: "2-digit",
	minute: "2-digit",
});

/** "Today", "Tomorrow" or "Mon 24 Nov", for the left edge of an agenda row. */
function dayLabel(date: Date, now: Date): string {
	const startOf = (value: Date) =>
		new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
	const days = Math.round((startOf(date) - startOf(now)) / 86_400_000);
	if (days === 0) return "Today";
	if (days === 1) return "Tomorrow";
	return shortDayFormatter.format(date);
}

type AgendaItem = {
	key: string;
	kind: "lecture" | "deadline";
	title: string;
	subjectId: string;
	subjectName: string;
	at: Date;
	place?: string;
	status?: string;
};

/**
 * A dashboard stat. Until its query resolves the value slot holds a skeleton the
 * size of the number it will become, so the card cannot be read as "0" while the
 * count is still on its way; a resolved count that is unknown (a failed query)
 * shows "—" rather than a zero.
 */
function Metric({
	label,
	value,
	foot,
	loading,
}: {
	label: string;
	value: string | number | undefined;
	foot: string;
	loading: boolean;
}) {
	return (
		<div className="card" aria-busy={loading || undefined}>
			<div className="metric">
				<p className="metric__label">{label}</p>
				<div className="metric__value num">
					{loading ? (
						<span
							style={{
								display: "flex",
								alignItems: "center",
								minHeight: "1.4em",
							}}
						>
							<Skeleton variant="title" width="64px" />
							<span className="visually-hidden">Loading</span>
						</span>
					) : (
						(value ?? "—")
					)}
				</div>
				<p className="metric__foot">{foot}</p>
			</div>
		</div>
	);
}

function Agenda({
	items,
	loading,
	error,
	onRetry,
}: {
	items: AgendaItem[];
	loading: boolean;
	error: unknown;
	onRetry: () => void;
}) {
	const now = new Date();
	return (
		<Card>
			<CardHeader title="Coming up" hint="Lectures and deadlines" />
			{loading ? (
				<SkeletonStack rows={4} />
			) : error ? (
				<ErrorState
					title="Agenda could not be loaded"
					message={errorMessage(error)}
					onRetry={onRetry}
				/>
			) : items.length === 0 ? (
				<EmptyState
					icon={CalendarBlank}
					title="Nothing scheduled"
					description="Upcoming lectures and assignment deadlines appear here."
				/>
			) : (
				<ul className="agenda">
					{items.map((item) => (
						<li key={item.key}>
							<Link
								to="/subjects/$subjectId"
								params={{ subjectId: item.subjectId }}
								className="agenda__row"
							>
								<span className="agenda__when">
									<span className="agenda__day">{dayLabel(item.at, now)}</span>
									<span className="agenda__time num">
										{timeFormatter.format(item.at)}
									</span>
								</span>
								<span
									className={`agenda__icon agenda__icon--${item.kind}`}
									aria-hidden="true"
								>
									{item.kind === "lecture" ? (
										<Chalkboard size={16} weight="regular" />
									) : (
										<ClipboardText size={16} weight="regular" />
									)}
								</span>
								<span className="agenda__text">
									<span className="agenda__title">{item.title}</span>
									<span className="agenda__meta">
										{item.kind === "lecture" ? "Lecture" : "Due"} ·{" "}
										{item.subjectName}
										{item.place ? ` · Room ${item.place}` : null}
									</span>
								</span>
								{item.status ? (
									<Badge tone="outline">{item.status}</Badge>
								) : null}
							</Link>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}

function SubjectList({
	subjects,
	loading,
	error,
	onRetry,
	emptyDescription,
}: {
	subjects: { id: string; name: string; code?: string; detail: string }[];
	loading: boolean;
	error: unknown;
	onRetry: () => void;
	emptyDescription: string;
}) {
	const { hasModule } = useAuth();
	return (
		<Card>
			<CardHeader
				title="Your subjects"
				actions={
					hasModule("subjects") ? (
						<Link to="/subjects" className="link-button">
							All subjects
						</Link>
					) : hasModule("records") ? (
						<Link to="/record" className="link-button">
							Study record
						</Link>
					) : null
				}
			/>
			{loading ? (
				<SkeletonStack rows={3} />
			) : error ? (
				<ErrorState
					title="Subjects could not be loaded"
					message={errorMessage(error)}
					onRetry={onRetry}
				/>
			) : subjects.length === 0 ? (
				<EmptyState
					icon={Books}
					title="No subjects yet"
					description={emptyDescription}
				/>
			) : (
				<ul className="dash-subjects">
					{subjects.map((subject) => (
						<li key={subject.id}>
							<Link
								to="/subjects/$subjectId"
								params={{ subjectId: subject.id }}
								className="dash-subjects__row"
							>
								<span className="dash-subjects__text">
									<span className="dash-subjects__name">
										{subject.name}
										{subject.code ? (
											<span className="dash-subjects__code">
												{subject.code}
											</span>
										) : null}
									</span>
									<span className="dash-subjects__detail">
										{subject.detail}
									</span>
								</span>
								<CaretRight size={14} weight="bold" aria-hidden="true" />
							</Link>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}

function useSubjectDetails(ids: string[]) {
	return useQueries({
		queries: ids.slice(0, DETAIL_LIMIT).map((id) => ({
			queryKey: queryKeys.subject(id),
			queryFn: () => api.subject(id),
			staleTime: 15_000,
		})),
	});
}

function lecturesFrom(
	details: (SubjectDetail | undefined)[],
	now: number,
): AgendaItem[] {
	return details.flatMap((subject) =>
		subject
			? subject.lectures
					.filter(
						(lecture) =>
							lecture.scheduled_at && Date.parse(lecture.scheduled_at) >= now,
					)
					.map((lecture) => ({
						key: `lecture-${lecture.id}`,
						kind: "lecture" as const,
						title: lecture.title,
						subjectId: subject.id,
						subjectName: subject.name,
						at: new Date(lecture.scheduled_at as string),
						place: lecture.class_name,
					}))
			: [],
	);
}

function soonest(items: AgendaItem[]): AgendaItem[] {
	return items
		.sort((a, b) => a.at.getTime() - b.at.getTime())
		.slice(0, UPCOMING_LIMIT);
}

function StaffDashboard() {
	const { hasModule } = useAuth();
	const canListStudents = hasModule("users") || hasModule("students");
	const subjects = useSubjects({ page: 1, page_size: 50 });
	const students = useUsers({ page: 1, page_size: 10, role: "STUDENT" });
	const ids = (subjects.data?.items ?? []).map((subject) => subject.id);
	const details = useSubjectDetails(ids);
	const now = Date.now();

	const detailData = details.map((query) => query.data);
	const deadlines: AgendaItem[] = detailData.flatMap((subject) =>
		subject
			? subject.assignments
					.filter(
						(assignment) =>
							assignment.due_at && Date.parse(assignment.due_at) >= now,
					)
					.map((assignment) => ({
						key: `assignment-${assignment.id}`,
						kind: "deadline" as const,
						title: assignment.title,
						subjectId: subject.id,
						subjectName: subject.name,
						at: new Date(assignment.due_at as string),
						place: assignment.class_name,
						status: assignment.is_published ? undefined : "Draft",
					}))
			: [],
	);
	const agenda = soonest([...lecturesFrom(detailData, now), ...deadlines]);

	const weekAhead = now + 7 * 86_400_000;
	// isLoading (not isPending): a query the role cannot run never fetches, and
	// its "pending" would otherwise hold a skeleton on screen forever.
	const detailsLoading =
		subjects.isLoading || details.some((query) => query.isLoading);
	const detailsError =
		subjects.error ?? details.find((query) => query.error)?.error ?? null;
	const lecturesThisWeek = lecturesFrom(detailData, now).filter(
		(lecture) => lecture.at.getTime() <= weekAhead,
	).length;
	const openAssignments = deadlines.length;
	const subjectRows = (subjects.data?.items ?? [])
		.slice(0, 6)
		.map((subject) => ({
			id: subject.id,
			name: subject.name,
			code: subject.code,
			detail: [
				subject.lecturer_name,
				plural(subject.counts.lectures, "lecture", "lectures"),
				plural(subject.counts.assignments, "assignment", "assignments"),
			]
				.filter(Boolean)
				.join(" · "),
		}));

	return (
		<div className="stack">
			<div className="grid grid--4">
				<Metric
					label="Students"
					value={
						canListStudents
							? students.isError
								? undefined
								: students.data?.total
							: "—"
					}
					foot="Student accounts"
					loading={canListStudents && students.isLoading}
				/>
				<Metric
					label="Subjects"
					value={subjects.isError ? undefined : subjects.data?.total}
					foot="This school year"
					loading={subjects.isLoading}
				/>
				<Metric
					label="Lectures this week"
					value={detailsError ? undefined : lecturesThisWeek}
					foot="Next 7 days"
					loading={detailsLoading}
				/>
				<Metric
					label="Open assignments"
					value={detailsError ? undefined : openAssignments}
					foot="Deadline still ahead"
					loading={detailsLoading}
				/>
			</div>

			<div className="dash-columns">
				<Agenda
					items={agenda}
					loading={detailsLoading}
					error={detailsError}
					onRetry={() => {
						void subjects.refetch();
						for (const query of details) void query.refetch();
					}}
				/>
				<SubjectList
					subjects={subjectRows}
					loading={subjects.isLoading}
					error={subjects.error}
					onRetry={() => void subjects.refetch()}
					emptyDescription="Subjects you teach or take appear here."
				/>
			</div>
		</div>
	);
}

function StudentDashboard({ studentId }: { studentId: string }) {
	const { hasModule } = useAuth();
	const assignments = useStudentAssignments(
		hasModule("assignments") ? studentId : undefined,
	);
	const record = useStudentRecord(hasModule("records") ? studentId : undefined);
	const entries = record.data?.entries ?? [];
	const subjectIds = [...new Set(entries.map((entry) => entry.subject_id))];
	const details = useSubjectDetails(subjectIds);
	const now = Date.now();
	const weekAhead = now + 7 * 86_400_000;

	const open = (assignments.data ?? []).filter(
		(assignment) =>
			assignment.due_at &&
			Date.parse(assignment.due_at) >= now &&
			(assignment.status === "todo" || assignment.status === "overdue"),
	);
	const deadlines: AgendaItem[] = open.map((assignment) => ({
		key: `assignment-${assignment.id}`,
		kind: "deadline",
		title: assignment.title,
		subjectId: assignment.subject_id,
		subjectName: assignment.subject_name,
		at: new Date(assignment.due_at as string),
		place: assignment.class_name,
	}));
	const agenda = soonest([
		...lecturesFrom(
			details.map((query) => query.data),
			now,
		),
		...deadlines,
	]);

	const subjectRows = entries.map((entry) => ({
		id: entry.subject_id,
		name: entry.subject_name,
		detail:
			entry.status === "in_progress"
				? entry.total_points != null
					? `In progress · ${entry.total_points} points so far`
					: "In progress"
				: `${entry.status === "passed" ? "Passed" : entry.status === "failed" ? "Failed" : "Withdrawn"}${
						entry.grade != null ? ` · grade ${entry.grade}` : ""
					}`,
	}));

	return (
		<div className="stack">
			<div className="grid grid--4">
				<Metric
					label="Subjects"
					value={record.isError ? undefined : subjectIds.length}
					foot="On your study record"
					loading={record.isLoading}
				/>
				<Metric
					label="Due this week"
					value={
						assignments.isError
							? undefined
							: open.filter((a) => Date.parse(a.due_at as string) <= weekAhead)
									.length
					}
					foot="Assignments not yet handed in"
					loading={assignments.isLoading}
				/>
				<Metric
					label="Average grade"
					value={
						record.isError ? undefined : (record.data?.gpa?.toFixed(2) ?? "—")
					}
					foot="Weighted by credits"
					loading={record.isLoading}
				/>
				<Metric
					label="Credits"
					value={record.isError ? undefined : record.data?.credits_earned}
					foot={
						record.data
							? `${record.data.credits_in_flight} more in progress`
							: "ECTS earned"
					}
					loading={record.isLoading}
				/>
			</div>

			<div className="dash-columns">
				<Agenda
					items={agenda}
					// Lectures come from the record's subjects, so the agenda waits
					// for both lists before it may say it is empty.
					loading={
						assignments.isLoading ||
						record.isLoading ||
						details.some((query) => query.isLoading)
					}
					error={
						assignments.error ??
						record.error ??
						details.find((query) => query.error)?.error ??
						null
					}
					onRetry={() => {
						void assignments.refetch();
						void record.refetch();
						for (const query of details) void query.refetch();
					}}
				/>
				<SubjectList
					subjects={subjectRows}
					loading={record.isLoading}
					error={record.error}
					onRetry={() => void record.refetch()}
					emptyDescription="Subjects on your study record appear here once you are enrolled."
				/>
			</div>
		</div>
	);
}

function SystemStatus() {
	const health = useHealth();
	const ok = health.data?.status === "ok" && health.data?.db === "up";
	// A skeleton holds the badge's place, so the header does not jump when the
	// answer arrives and a missing badge is never mistaken for "no problem".
	if (health.isLoading)
		return (
			<span aria-busy="true">
				<span
					className="skeleton"
					style={{ display: "inline-block", width: "132px", height: "18px" }}
				/>
				<span className="visually-hidden">Checking the system status</span>
			</span>
		);
	return (
		<Badge
			tone={ok ? "success" : "error"}
			title={
				ok
					? "Backend and database are up"
					: "The backend is not responding normally"
			}
		>
			{ok ? "All systems normal" : "Backend issue"}
		</Badge>
	);
}

function DashboardPage() {
	const session = useSession();
	const { isAdmin } = useAuth();
	const now = new Date();
	const firstName = session.user.name.split(" ")[0];
	const isStudent = session.user.role === "STUDENT";

	return (
		<>
			<PageHeader
				title={`${greeting(now)}, ${firstName}`}
				description={dayFormatter.format(now)}
				actions={isAdmin ? <SystemStatus /> : null}
			/>
			{isStudent ? (
				<StudentDashboard studentId={session.user.id} />
			) : (
				<StaffDashboard />
			)}
		</>
	);
}

export const dashboardRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/",
	component: DashboardPage,
});
