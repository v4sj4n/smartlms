import { ArrowLeft } from "@phosphor-icons/react";
import { createRoute, Link } from "@tanstack/react-router";
import { errorMessage } from "../api";
import { useAuth } from "../auth";
import { LecturerSubmissionInbox } from "../components/assignments/LecturerSubmissionInbox";
import { StudentSubmissionPanel } from "../components/assignments/StudentSubmissionPanel";
import { ModuleGate } from "../components/ModuleGate";
import {
	Badge,
	Card,
	ErrorState,
	PageHeader,
	SkeletonStack,
} from "../components/ui";
import { formatDateTime } from "../format";
import { useAssignment } from "../queries";
import { appLayoutRoute } from "./app-layout";

/**
 * One assignment, two audiences.
 *
 * A student gets the instructions next to their own submission: what they have
 * handed in, what it scored, and the form that replaces it. Staff get the inbox
 * — the whole roster, with the work and the grade entry for each name. The role
 * decides which one is mounted, so a student never queries the roster.
 */
function AssignmentDetailContent({ assignmentId }: { assignmentId: string }) {
	const { session, hasPermission } = useAuth();
	const isStudent = session?.user.role === "STUDENT";
	const studentId = isStudent ? session?.user.id : undefined;

	const detail = useAssignment(assignmentId, studentId);

	if (detail.isPending) {
		return (
			<Card className="card--padded">
				<SkeletonStack rows={5} />
			</Card>
		);
	}

	if (detail.isError) {
		return (
			<Card className="card--padded">
				<ErrorState
					title="Assignment could not be loaded"
					message={errorMessage(detail.error)}
					onRetry={() => void detail.refetch()}
				/>
			</Card>
		);
	}

	const assignment = detail.data.assignment;
	const submission = detail.data.submission;
	const due = assignment.due_at ? new Date(assignment.due_at) : null;
	const overdue = due !== null && due.getTime() < Date.now();
	// Past the deadline with late hand-ins refused: the same clock the API
	// applies to both the text submission and the file upload.
	const closed = overdue && !assignment.allow_late;

	const instructions = (
		<Card className="card--padded">
			<h2 className="card__title">Instructions</h2>
			<p className="content-row__body">
				{assignment.description ?? "The lecturer gave no extra instructions."}
			</p>
			<div className="content-row__meta">
				<span>
					Due:{" "}
					{assignment.due_at ? (
						<span className={`num${overdue ? " overdue" : ""}`}>
							{formatDateTime(assignment.due_at)}
						</span>
					) : (
						"no deadline"
					)}
				</span>
				{assignment.scheduled_at ? (
					<span>
						Session:{" "}
						<span className="num">
							{formatDateTime(assignment.scheduled_at)}
						</span>
					</span>
				) : null}
				{assignment.class_name ? (
					<span>Room: {assignment.class_name}</span>
				) : null}
			</div>
		</Card>
	);

	return (
		<>
			<Link to="/assignments" className="back-link">
				<ArrowLeft size={13} weight="bold" aria-hidden="true" />
				All assignments
			</Link>

			<PageHeader
				title={assignment.title}
				description={
					<span className="row row--tight">
						{detail.data.subject_name ? (
							<Link
								to="/subjects/$subjectId"
								params={{ subjectId: detail.data.subject_id ?? "" }}
							>
								{detail.data.subject_name}
							</Link>
						) : null}
						<Badge tone="outline">{assignment.max_points} points</Badge>
						<Badge tone="outline">
							{assignment.submission_type === "both"
								? "text or file"
								: assignment.submission_type === "file"
									? "file"
									: "text"}
						</Badge>
						{overdue ? (
							<Badge tone={closed ? "error" : "warning"}>
								{closed ? "closed" : "late accepted"}
							</Badge>
						) : null}
					</span>
				}
			/>

			{isStudent ? (
				<div className="grid grid--2 grid--top">
					{instructions}
					<StudentSubmissionPanel
						assignmentId={assignmentId}
						subjectId={detail.data.subject_id}
						assignment={assignment}
						submission={submission}
						closed={closed}
					/>
				</div>
			) : (
				<div className="stack">
					{instructions}
					<LecturerSubmissionInbox
						assignmentId={assignmentId}
						subjectId={detail.data.subject_id}
						maxPoints={assignment.max_points}
						canGrade={hasPermission("assignments.grade")}
					/>
				</div>
			)}
		</>
	);
}

function AssignmentDetailPage() {
	const { assignmentId } = assignmentDetailRoute.useParams();
	return (
		<ModuleGate moduleKey="assignments">
			<AssignmentDetailContent assignmentId={assignmentId} />
		</ModuleGate>
	);
}

export const assignmentDetailRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/assignments/$assignmentId",
	component: AssignmentDetailPage,
});
