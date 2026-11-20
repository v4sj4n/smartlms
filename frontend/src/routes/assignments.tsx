import {
	CheckCircle,
	Clock,
	WarningCircle,
	XCircle,
} from "@phosphor-icons/react";
import { createRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
	type AssignmentStatus,
	errorMessage,
	type StudentAssignment,
} from "../api";
import { useAuth } from "../auth";
import { ModuleGate } from "../components/ModuleGate";
import { StaffAssignments } from "../components/subjects/StaffOverviews";
import {
	Badge,
	Card,
	Chip,
	EmptyState,
	ErrorState,
	PageHeader,
	SkeletonStack,
	Table,
	Td,
	Th,
} from "../components/ui";
import { formatDateTime } from "../format";
import { useStudentAssignments } from "../queries";
import { appLayoutRoute } from "./app-layout";

type Filter = "open" | "submitted" | "graded" | "all";

const FILTERS: { key: Filter; label: string }[] = [
	{ key: "open", label: "To do" },
	{ key: "submitted", label: "Submitted" },
	{ key: "graded", label: "Graded" },
	{ key: "all", label: "All" },
];

function statusBadge(status: AssignmentStatus) {
	switch (status) {
		case "graded":
			return (
				<Badge tone="success">
					<CheckCircle size={11} weight="regular" aria-hidden="true" /> graded
				</Badge>
			);
		case "submitted":
			return <Badge tone="primary">submitted</Badge>;
		case "late":
			return (
				<Badge tone="warning">
					<Clock size={11} weight="regular" aria-hidden="true" /> late
				</Badge>
			);
		case "overdue":
			return (
				<Badge tone="error">
					<XCircle size={11} weight="regular" aria-hidden="true" /> overdue
				</Badge>
			);
		case "closed":
			return (
				<Badge tone="error">
					<WarningCircle size={11} weight="regular" aria-hidden="true" /> closed
				</Badge>
			);
		default:
			return <Badge tone="outline">to do</Badge>;
	}
}

function matches(filter: Filter, assignment: StudentAssignment): boolean {
	if (filter === "all") return true;
	if (filter === "open") {
		return (
			assignment.status === "todo" ||
			assignment.status === "overdue" ||
			assignment.status === "closed"
		);
	}
	if (filter === "submitted") {
		return assignment.status === "submitted" || assignment.status === "late";
	}
	return assignment.status === "graded";
}

function AssignmentsContent() {
	const { session } = useAuth();
	const isStudent = session?.user.role === "STUDENT";
	const assignments = useStudentAssignments(
		isStudent ? session?.user.id : undefined,
	);
	const [filter, setFilter] = useState<Filter>("open");

	const rows = useMemo(
		() =>
			(assignments.data ?? []).filter((assignment) =>
				matches(filter, assignment),
			),
		[assignments.data, filter],
	);

	const counts = useMemo(() => {
		const all = assignments.data ?? [];
		return {
			open: all.filter((assignment) => matches("open", assignment)).length,
			submitted: all.filter((assignment) => matches("submitted", assignment))
				.length,
			graded: all.filter((assignment) => matches("graded", assignment)).length,
			all: all.length,
		} satisfies Record<Filter, number>;
	}, [assignments.data]);

	if (!isStudent) {
		return (
			<>
				<PageHeader
					title="Assignments"
					description="Every assignment across your subjects. Open one to read submissions and enter points."
				/>
				<StaffAssignments />
			</>
		);
	}

	return (
		<>
			<PageHeader
				title="Assignments"
				description="Every deadline across your subjects, earliest first."
			/>

			<div className="tabs" role="tablist" aria-label="Assignment filters">
				{FILTERS.map((entry) => {
					const active = entry.key === filter;
					return (
						<button
							key={entry.key}
							type="button"
							role="tab"
							aria-selected={active}
							className={["tab", active ? "tab--active" : ""]
								.filter(Boolean)
								.join(" ")}
							onClick={() => setFilter(entry.key)}
						>
							<span>{entry.label}</span>
							<span className="tab__count num">{counts[entry.key]}</span>
						</button>
					);
				})}
			</div>

			{assignments.isPending ? (
				<Card>
					<SkeletonStack rows={5} />
				</Card>
			) : assignments.isError ? (
				<Card>
					<ErrorState
						title="Assignments could not be loaded"
						message={errorMessage(assignments.error)}
						onRetry={() => void assignments.refetch()}
					/>
				</Card>
			) : rows.length === 0 ? (
				<Card>
					<EmptyState
						icon={CheckCircle}
						title={filter === "open" ? "Nothing due" : "Nothing here"}
						description={
							filter === "open"
								? "You have handed in everything that is currently open."
								: "No assignment matches this filter right now."
						}
					/>
				</Card>
			) : (
				<Card className="card--flush">
					<Table caption="Your assignments">
						<thead>
							<tr>
								<Th>Assignment</Th>
								<Th>Subject</Th>
								<Th>Due</Th>
								<Th>Status</Th>
								<Th align="right">Score</Th>
							</tr>
						</thead>
						<tbody>
							{rows.map((assignment) => (
								<tr key={assignment.id}>
									<Td>
										<Link
											to="/assignments/$assignmentId"
											params={{ assignmentId: assignment.id }}
											className="table__primary"
										>
											{assignment.title}
										</Link>
										<span className="table__secondary">
											{assignment.max_points} points ·{" "}
											{assignment.submission_type === "both"
												? "text or file"
												: assignment.submission_type}
										</span>
									</Td>
									<Td>{assignment.subject_name}</Td>
									<Td>
										{assignment.due_at ? (
											<span className="num">
												{formatDateTime(assignment.due_at)}
											</span>
										) : (
											"—"
										)}
									</Td>
									<Td>{statusBadge(assignment.status)}</Td>
									<Td align="right">
										<span className="num">
											{assignment.score === null
												? "—"
												: `${assignment.score} / ${assignment.max_points}`}
										</span>
									</Td>
								</tr>
							))}
						</tbody>
					</Table>
				</Card>
			)}

			<Chip tone="muted">
				Late work is marked late, not rejected, when the lecturer allows it.
			</Chip>
		</>
	);
}

function AssignmentsPage() {
	return (
		<ModuleGate moduleKey="assignments">
			<AssignmentsContent />
		</ModuleGate>
	);
}

export const assignmentsRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/assignments",
	component: AssignmentsPage,
});
