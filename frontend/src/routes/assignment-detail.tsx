import {
	ArrowLeft,
	CheckCircle,
	ClipboardText,
	Paperclip,
	WarningCircle,
} from "@phosphor-icons/react";
import { createRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage } from "../api";
import { useAuth } from "../auth";
import { ModuleGate } from "../components/ModuleGate";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	ErrorState,
	InlineNote,
	PageHeader,
	SkeletonStack,
	Table,
	Td,
	TextArea,
	TextField,
	Th,
} from "../components/ui";
import { formatDateTime } from "../format";
import {
	useAssignment,
	useAssignmentMutations,
	useAssignmentSubmissions,
} from "../queries";
import { toastApiError, toastSuccess } from "../toast";
import { appLayoutRoute } from "./app-layout";

function AssignmentDetailContent({ assignmentId }: { assignmentId: string }) {
	const { session, hasPermission } = useAuth();
	const isStudent = session?.user.role === "STUDENT";
	const studentId = isStudent ? session?.user.id : undefined;

	const detail = useAssignment(assignmentId, studentId);
	const submissions = useAssignmentSubmissions(
		isStudent ? undefined : assignmentId,
	);
	const { submit, grade } = useAssignmentMutations(detail.data?.subject_id);

	const [content, setContent] = useState("");
	const [fileUrl, setFileUrl] = useState("");
	const [draftScores, setDraftScores] = useState<Record<string, string>>({});
	const [draftFeedback, setDraftFeedback] = useState<Record<string, string>>(
		{},
	);

	if (detail.isPending) {
		return (
			<Card>
				<SkeletonStack rows={5} />
			</Card>
		);
	}

	if (detail.isError) {
		return (
			<Card>
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
	const closed = overdue && !assignment.allow_late;
	const graded = submission?.status === "graded";

	const submitWork = async () => {
		if (!studentId) return;
		try {
			await submit.mutateAsync({
				assignmentId,
				input: {
					student_id: studentId,
					content: content.trim() || undefined,
					file_url: fileUrl.trim() || undefined,
				},
			});
			toastSuccess("Handed in", assignment.title);
			setContent("");
			setFileUrl("");
			void detail.refetch();
		} catch (error) {
			toastApiError(error, "Hand-in failed");
		}
	};

	const saveGrade = async (submissionId: string) => {
		const raw = draftScores[submissionId] ?? "";
		const score = raw.trim() === "" ? null : Number(raw);
		if (score !== null && Number.isNaN(score)) {
			toastApiError(new Error("Score must be a number."), "Score not saved");
			return;
		}
		try {
			await grade.mutateAsync({
				submissionId,
				grader_id: session?.user.id ?? "",
				score,
				feedback: draftFeedback[submissionId] ?? undefined,
			});
			toastSuccess("Grade saved");
			setDraftScores((current) => {
				const next = { ...current };
				delete next[submissionId];
				return next;
			});
		} catch (error) {
			toastApiError(error, "Grade could not be saved");
		}
	};

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

			<div className="grid grid--2 grid--top">
				<Card className="card--padded">
					<h2 className="card__title">Instructions</h2>
					<p className="content-row__body">
						{assignment.description ??
							"The lecturer gave no extra instructions."}
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

				{isStudent ? (
					<Card className="card--padded">
						<h2 className="card__title">Your submission</h2>
						{submission ? (
							<div className="stack--sm">
								<p className="row row--tight">
									<Badge tone={graded ? "success" : "primary"}>
										{submission.status}
									</Badge>
									<span className="num">
										{submission.score === null
											? "not graded yet"
											: `${submission.score} / ${submission.max_points}`}
									</span>
								</p>
								<p className="content-row__meta">
									Handed in{" "}
									<span className="num">
										{formatDateTime(submission.submitted_at)}
									</span>
								</p>
								{submission.content ? (
									<p className="content-row__body">{submission.content}</p>
								) : null}
								{submission.file_url ? (
									<p className="row row--tight">
										<Paperclip size={13} weight="regular" aria-hidden="true" />
										<a
											href={submission.file_url}
											target="_blank"
											rel="noreferrer"
										>
											Attached file
										</a>
									</p>
								) : null}
								{submission.feedback ? (
									<InlineNote>
										<strong>Feedback:</strong> {submission.feedback}
									</InlineNote>
								) : null}
							</div>
						) : (
							<p className="content-row__body">
								You have not handed anything in yet.{" "}
								{closed ? "The deadline has passed." : null}
							</p>
						)}

						{!graded ? (
							<div className="stack--sm assignment-form">
								{assignment.submission_type !== "file" ? (
									<TextArea
										label={submission ? "Replace your answer" : "Your answer"}
										value={content}
										onChange={setContent}
										rows={4}
										placeholder="Write your answer here."
									/>
								) : null}
								{assignment.submission_type !== "text" ? (
									<TextField
										label="File link"
										value={fileUrl}
										onChange={setFileUrl}
										placeholder="https://drive.example.com/my-work.pdf"
										hint="Paste a share link to the file. Uploads land in a later pass."
									/>
								) : null}
								<div className="row">
									<Button
										variant="primary"
										disabled={
											submit.isPending ||
											closed ||
											(assignment.submission_type !== "file" &&
												!content.trim() &&
												!fileUrl.trim()) ||
											(assignment.submission_type === "file" &&
												!fileUrl.trim()) ||
											(assignment.submission_type === "text" && !content.trim())
										}
										icon={
											submit.isPending ? (
												<CheckCircle
													size={14}
													weight="bold"
													aria-hidden="true"
												/>
											) : null
										}
										onClick={() => void submitWork()}
									>
										{submission ? "Replace submission" : "Hand in"}
									</Button>
								</div>
								{closed ? (
									<p className="form-note">
										<WarningCircle
											size={13}
											weight="regular"
											aria-hidden="true"
										/>{" "}
										The deadline passed and the lecturer closed late hand-ins.
									</p>
								) : null}
							</div>
						) : (
							<InlineNote>
								This submission is graded, so it can no longer be changed.
							</InlineNote>
						)}
					</Card>
				) : (
					<Card className="card--padded">
						<h2 className="card__title">Submissions</h2>
						{submissions.isPending ? <SkeletonStack rows={3} /> : null}
						{submissions.isError ? (
							<ErrorState
								title="Submissions could not be loaded"
								message={errorMessage(submissions.error)}
								onRetry={() => void submissions.refetch()}
							/>
						) : null}
						{(submissions.data ?? []).length === 0 && !submissions.isPending ? (
							<EmptyState
								icon={ClipboardText}
								title="Nothing handed in yet"
								description="Students appear here as soon as they submit."
							/>
						) : null}
						{(submissions.data ?? []).length > 0 ? (
							<Table caption="Submissions">
								<thead>
									<tr>
										<Th>Student</Th>
										<Th>Handed in</Th>
										<Th align="right">Score</Th>
										<Th>Feedback</Th>
										<Th align="right">Save</Th>
									</tr>
								</thead>
								<tbody>
									{submissions.data?.map((row) => (
										<tr key={row.id}>
											<Td>
												<span className="table__primary">
													{row.student_name}
												</span>
												<span className="table__secondary">{row.status}</span>
											</Td>
											<Td>
												<span className="num">
													{formatDateTime(row.submitted_at)}
												</span>
											</Td>
											<Td align="right">
												<input
													className="gradebook__input num"
													inputMode="numeric"
													aria-label={`Score for ${row.student_name}`}
													placeholder={
														row.score === null ? "–" : String(row.score)
													}
													value={draftScores[row.id] ?? ""}
													onChange={(event) =>
														setDraftScores((current) => ({
															...current,
															[row.id]: event.target.value,
														}))
													}
												/>
											</Td>
											<Td>
												<input
													className="gradebook__input gradebook__input--wide"
													aria-label={`Feedback for ${row.student_name}`}
													placeholder={row.feedback ?? "Feedback"}
													value={draftFeedback[row.id] ?? ""}
													onChange={(event) =>
														setDraftFeedback((current) => ({
															...current,
															[row.id]: event.target.value,
														}))
													}
												/>
											</Td>
											<Td align="right">
												<Button
													variant="secondary"
													size="sm"
													disabled={grade.isPending}
													onClick={() => void saveGrade(row.id)}
												>
													Save
												</Button>
											</Td>
										</tr>
									))}
								</tbody>
							</Table>
						) : null}
						<InlineNote>
							Grades entered here are the assignment score. The subject total
							comes from the weighted components on the subject's Grades tab.
						</InlineNote>
					</Card>
				)}
			</div>

			{!isStudent && !hasPermission("assignments.grade") ? (
				<InlineNote>
					Your role can read submissions but not grade them.
				</InlineNote>
			) : null}
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
