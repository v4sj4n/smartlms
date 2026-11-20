import { Trash, UserPlus, UsersThree } from "@phosphor-icons/react";
import { useState } from "react";
import { errorMessage, type SubjectEnrollment } from "../../api";
import { useAuth } from "../../auth";
import { formatDateTime, initials } from "../../format";
import { useSubjectEnrollments, useUnenrollStudent } from "../../queries";
import { ConfirmDialog } from "../ConfirmDialog";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	ErrorState,
	IconButton,
	SkeletonStack,
	Table,
	Td,
	Th,
} from "../ui";
import { AddStudentsDialog } from "./AddStudentsDialog";

/**
 * Who takes the subject. The roster is the gradebook's student list and the set
 * of people who may open the subject at all, so it is a staff screen: the tab
 * only exists for holders of subjects.manage.
 */
export function ParticipantsPanel({
	subjectId,
	subjectName,
}: {
	subjectId: string;
	subjectName: string;
}) {
	const roster = useSubjectEnrollments(subjectId);
	const unenroll = useUnenrollStudent(subjectId);
	const { hasPermission } = useAuth();
	const [adding, setAdding] = useState(false);
	const [removing, setRemoving] = useState<SubjectEnrollment | null>(null);

	// Adding needs the student directory (GET /api/students asks for users.view),
	// while removing needs only subjects.manage. Say so up front rather than
	// letting the add dialog be the surprise.
	const canSearchDirectory = hasPermission("users.view");
	const enrolled = roster.data?.enrolled ?? [];
	const enrolledIds = new Set(enrolled.map((row) => row.student_id));

	if (roster.isPending) {
		return (
			<Card>
				<SkeletonStack rows={5} />
			</Card>
		);
	}

	if (roster.isError) {
		return (
			<Card>
				<ErrorState
					title="The roster could not be loaded"
					message={errorMessage(roster.error)}
					onRetry={() => void roster.refetch()}
				/>
			</Card>
		);
	}

	return (
		<>
			<Card className="card--flush">
				<div className="gradebook__toolbar">
					<span className="row row--tight">
						<Badge tone="outline">
							{enrolled.length === 1
								? "1 student enrolled"
								: `${enrolled.length} students enrolled`}
						</Badge>
						<span className="card__hint">
							{canSearchDirectory
								? "Only the students on this list can open the subject."
								: "Only the students on this list can open the subject. An administrator adds new ones."}
						</span>
					</span>
					<Button
						variant="primary"
						size="sm"
						icon={<UserPlus size={15} weight="bold" aria-hidden="true" />}
						disabled={adding}
						onClick={() => setAdding(true)}
					>
						Add students
					</Button>
				</div>

				{enrolled.length === 0 ? (
					<EmptyState
						icon={UsersThree}
						title="Nobody is enrolled yet"
						description={
							canSearchDirectory
								? "Add the students who take this subject. Until then its weeks, lectures and materials stay closed to them, and the gradebook has no columns to fill in."
								: "Searching the student directory needs the users.view permission. An administrator can add the students who take this subject; once they are on the roster it works as usual."
						}
						action={
							<Button
								variant="secondary"
								size="sm"
								icon={
									<UserPlus size={15} weight="regular" aria-hidden="true" />
								}
								onClick={() => setAdding(true)}
							>
								Add students
							</Button>
						}
					/>
				) : (
					<Table caption={`Students enrolled in ${subjectName}`}>
						<thead>
							<tr>
								<Th>Student</Th>
								<Th>Enrolled</Th>
								<Th align="right">
									<span className="visually-hidden">Remove</span>
								</Th>
							</tr>
						</thead>
						<tbody>
							{enrolled.map((row) => (
								<tr key={row.enrollment_id}>
									<Td>
										<span className="student-cell">
											<span className="avatar" aria-hidden="true">
												{initials(row.name)}
											</span>
											<span>
												<span className="table__primary">{row.name}</span>
												<span className="table__secondary">{row.email}</span>
											</span>
										</span>
									</Td>
									<Td>
										<span className="num">
											{formatDateTime(row.enrolled_at)}
										</span>
									</Td>
									<Td align="right">
										<IconButton
											label={`Remove ${row.name} from the subject`}
											icon={
												<Trash size={14} weight="regular" aria-hidden="true" />
											}
											tone="danger"
											onClick={() => setRemoving(row)}
										/>
									</Td>
								</tr>
							))}
						</tbody>
					</Table>
				)}
			</Card>

			{adding ? (
				<AddStudentsDialog
					subjectId={subjectId}
					subjectName={subjectName}
					enrolledIds={enrolledIds}
					onClose={() => setAdding(false)}
				/>
			) : null}

			{removing ? (
				<ConfirmDialog
					title={`Remove ${removing.name}?`}
					description={`They come off the roster of ${subjectName} and can no longer open it.`}
					consequences={
						<>
							Their submissions and grades stay on record — only the enrolment
							is removed. You can add them again at any time.
						</>
					}
					confirmLabel="Remove from subject"
					successMessage={`${removing.name} removed from ${subjectName}`}
					onConfirm={() => unenroll.mutateAsync(removing.student_id)}
					onClose={() => setRemoving(null)}
				/>
			) : null}
		</>
	);
}
