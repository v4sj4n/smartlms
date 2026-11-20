import {
	CaretDown,
	CaretUp,
	ClipboardText,
	DownloadSimple,
	LinkSimple,
} from "@phosphor-icons/react";
import { Fragment, useId, useMemo, useState } from "react";
import { errorMessage, type Submission, submissionFileUrl } from "../../api";
import { formatDateTime, humanize } from "../../format";
import {
	useAssignmentMutations,
	useAssignmentSubmissions,
	useSubjectEnrollments,
} from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { ConfirmDialog } from "../ConfirmDialog";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	ErrorState,
	InlineNote,
	SkeletonStack,
	Table,
	Td,
	TextArea,
	Th,
} from "../ui";
import { SubmissionFileLink } from "./SubmissionFileLink";

/** One line of the inbox: a student on the roster, and what they handed in. */
type InboxRow = {
	studentId: string;
	name: string;
	email: string;
	submission?: Submission;
};

/** A grade waiting on the "replace the recorded grade?" confirmation. */
type Regrade = {
	row: InboxRow;
	score: number | null;
	feedback: string;
};

function statusTone(submission: Submission | undefined) {
	if (!submission) return "outline" as const;
	if (submission.status === "graded") return "success" as const;
	if (submission.status === "late") return "warning" as const;
	return "primary" as const;
}

function statusLabel(submission: Submission | undefined) {
	return submission ? humanize(submission.status) : "Not submitted";
}

/**
 * The lecturer's inbox for one assignment: the subject roster left-joined with
 * the submissions, so a name missing from the submission list still appears —
 * "Not submitted" is information, an absent row is not.
 *
 * Reading and grading happen in an expanded row rather than inside the cells:
 * the answer can be a paragraph, and the feedback field is a textarea, neither
 * of which fits a table cell without pushing every row to its height. The row
 * itself stays a scannable line: who, when, status, score.
 */
export function LecturerSubmissionInbox({
	assignmentId,
	subjectId,
	maxPoints,
	canGrade,
}: {
	assignmentId: string;
	subjectId?: string;
	maxPoints: number;
	/** `assignments.grade`; a reader without it sees the work but no grade form. */
	canGrade: boolean;
}) {
	const submissions = useAssignmentSubmissions(assignmentId);
	const enrollments = useSubjectEnrollments(subjectId);
	const { grade } = useAssignmentMutations(subjectId);
	const scoreFieldId = useId();

	const [openStudent, setOpenStudent] = useState<string | null>(null);
	const [scoreDraft, setScoreDraft] = useState<Record<string, string>>({});
	const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>(
		{},
	);
	const [regrade, setRegrade] = useState<Regrade | null>(null);

	const roster = enrollments.data?.enrolled;

	const rows = useMemo(() => {
		const handedIn = new Map(
			(submissions.data ?? []).map((row) => [row.student_id, row]),
		);
		const onRoster = new Set((roster ?? []).map((entry) => entry.student_id));

		const merged: InboxRow[] = (roster ?? []).map((entry) => ({
			studentId: entry.student_id,
			name: entry.name,
			email: entry.email,
			submission: handedIn.get(entry.student_id),
		}));

		// Someone who handed in and was then unenrolled keeps their row: work that
		// was collected should never disappear from the inbox that collects it.
		for (const row of submissions.data ?? []) {
			if (!onRoster.has(row.student_id)) {
				merged.push({
					studentId: row.student_id,
					name: row.student_name || "Former student",
					email: "No longer enrolled",
					submission: row,
				});
			}
		}

		// Handed-in work first, newest first — that is the order a lecturer works
		// through — then the quiet majority alphabetically.
		return merged.sort((a, b) => {
			if (a.submission && !b.submission) return -1;
			if (!a.submission && b.submission) return 1;
			if (a.submission && b.submission) {
				return b.submission.submitted_at.localeCompare(
					a.submission.submitted_at,
				);
			}
			return a.name.localeCompare(b.name);
		});
	}, [roster, submissions.data]);

	const handedInCount = rows.filter((row) => row.submission).length;
	const gradedCount = rows.filter(
		(row) => row.submission?.status === "graded",
	).length;

	const scoreValue = (row: InboxRow) => {
		const id = row.submission?.id;
		if (!id) return "";
		const draft = scoreDraft[id];
		if (draft !== undefined) return draft;
		return row.submission?.score === null || row.submission?.score === undefined
			? ""
			: String(row.submission.score);
	};

	const feedbackValue = (row: InboxRow) => {
		const id = row.submission?.id;
		if (!id) return "";
		return feedbackDraft[id] ?? row.submission?.feedback ?? "";
	};

	const forgetDraft = (submissionId: string) => {
		setScoreDraft((current) => {
			const next = { ...current };
			delete next[submissionId];
			return next;
		});
		setFeedbackDraft((current) => {
			const next = { ...current };
			delete next[submissionId];
			return next;
		});
	};

	/** Writes the grade. Throws on failure; the caller decides how to report it. */
	const saveGrade = async (
		row: InboxRow,
		score: number | null,
		feedback: string,
	) => {
		if (!row.submission) return;
		await grade.mutateAsync({
			submissionId: row.submission.id,
			score,
			feedback: feedback.trim() || undefined,
		});
		forgetDraft(row.submission.id);
	};

	const commitGrade = async (
		row: InboxRow,
		score: number | null,
		feedback: string,
	) => {
		try {
			await saveGrade(row, score, feedback);
			toastSuccess(
				"Grade saved",
				`${row.name} — ${score === null ? "not graded" : `${score} / ${maxPoints}`}`,
			);
		} catch (error) {
			toastApiError(error, "Grade could not be saved");
		}
	};

	/**
	 * Reads the draft, checks it against the assignment's ceiling, and asks before
	 * overwriting a grade that is already recorded. The backend replaces a score
	 * without complaint, so the confirm is the only thing standing between a
	 * lecturer and silently changing a mark a student has already been shown.
	 */
	const requestSave = (row: InboxRow) => {
		if (!row.submission) return;
		const raw = scoreValue(row).trim();
		const score = raw === "" ? null : Number(raw);
		if (score !== null && Number.isNaN(score)) {
			toastApiError(new Error("Score must be a number."), "Grade not saved");
			return;
		}
		if (score !== null && (score < 0 || score > maxPoints)) {
			toastApiError(
				new Error(`Score must be between 0 and ${maxPoints}.`),
				"Grade not saved",
			);
			return;
		}
		const feedback = feedbackValue(row);

		if (row.submission.status === "graded") {
			setRegrade({ row, score, feedback });
			return;
		}
		void commitGrade(row, score, feedback);
	};

	if (submissions.isPending || enrollments.isPending) {
		return (
			<Card className="card--padded">
				<h2 className="card__title">Submissions</h2>
				<SkeletonStack rows={5} />
			</Card>
		);
	}

	if (submissions.isError || enrollments.isError) {
		return (
			<Card className="card--padded">
				<h2 className="card__title">Submissions</h2>
				<ErrorState
					title="Submissions could not be loaded"
					message={errorMessage(submissions.error ?? enrollments.error)}
					onRetry={() => {
						void submissions.refetch();
						void enrollments.refetch();
					}}
				/>
			</Card>
		);
	}

	if (rows.length === 0) {
		return (
			<Card className="card--padded">
				<h2 className="card__title">Submissions</h2>
				<EmptyState
					icon={ClipboardText}
					title="Nobody to collect from"
					description={
						subjectId
							? "No students are enrolled in this subject yet, so there is nothing to hand in."
							: "This assignment is not attached to a subject, so there is no roster to collect from."
					}
				/>
			</Card>
		);
	}

	return (
		<Card className="card--padded">
			<h2 className="card__title">Submissions</h2>
			<p className="content-row__meta">
				{roster && roster.length > 0
					? `${handedInCount} of ${roster.length} handed in`
					: `${handedInCount} handed in`}
				{gradedCount > 0 ? ` · ${gradedCount} graded` : ""}
				{handedInCount === 0 ? " — nothing handed in yet" : ""}
			</p>

			<Table caption="Submissions and grades">
				<thead>
					<tr>
						<Th>Student</Th>
						<Th>Submitted</Th>
						<Th>Status</Th>
						<Th align="right">Score</Th>
						<Th align="right">Work</Th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const open = openStudent === row.studentId;
						const submission = row.submission;
						return (
							<Fragment key={row.studentId}>
								<tr>
									<Td>
										<span className="table__primary gradebook__student">
											{row.name}
										</span>
										<span className="table__secondary">{row.email}</span>
									</Td>
									<Td>
										{submission ? (
											<span className="num">
												{formatDateTime(submission.submitted_at)}
											</span>
										) : (
											<span className="table__secondary">Not submitted</span>
										)}
									</Td>
									<Td>
										<Badge tone={statusTone(submission)}>
											{statusLabel(submission)}
										</Badge>
									</Td>
									<Td align="right">
										{submission?.score === null || !submission ? (
											<span className="table__secondary">–</span>
										) : (
											<span className="num">
												{submission.score} / {submission.max_points}
											</span>
										)}
									</Td>
									<Td align="right">
										<span className="row row--tight">
											{submission?.file_name ? (
												<a
													className="link-button"
													href={submissionFileUrl(submission.id)}
													download={submission.file_name}
													title={`Download ${submission.file_name}`}
												>
													<DownloadSimple
														size={13}
														weight="regular"
														aria-hidden="true"
													/>
													File
												</a>
											) : (
												<span className="table__secondary">No file</span>
											)}
											<Button
												variant="secondary"
												size="sm"
												aria-expanded={open}
												icon={
													open ? (
														<CaretUp
															size={12}
															weight="bold"
															aria-hidden="true"
														/>
													) : (
														<CaretDown
															size={12}
															weight="bold"
															aria-hidden="true"
														/>
													)
												}
												onClick={() =>
													setOpenStudent(open ? null : row.studentId)
												}
											>
												{open ? "Hide" : submission ? "Review" : "View"}
											</Button>
										</span>
									</Td>
								</tr>

								{open ? (
									<tr>
										<td colSpan={5}>
											{submission ? (
												<div className="stack--sm">
													<div className="content-row__meta">
														<span>
															Handed in{" "}
															<span className="num">
																{formatDateTime(submission.submitted_at)}
															</span>
														</span>
														{submission.graded_at ? (
															<span>
																Graded{" "}
																<span className="num">
																	{formatDateTime(submission.graded_at)}
																</span>
															</span>
														) : null}
													</div>

													{submission.content ? (
														<p className="content-row__body">
															{submission.content}
														</p>
													) : null}

													{submission.file_name ? (
														<SubmissionFileLink submission={submission} />
													) : null}

													{submission.file_url ? (
														<p className="row row--tight">
															<LinkSimple
																size={13}
																weight="regular"
																aria-hidden="true"
															/>
															<a
																href={submission.file_url}
																target="_blank"
																rel="noreferrer"
																title={submission.file_url}
															>
																Pasted link
															</a>
														</p>
													) : null}

													{submission.content ||
													submission.file_name ||
													submission.file_url ? null : (
														<p className="table__secondary">
															This hand-in has no answer, file or link in it.
														</p>
													)}

													{submission.status === "graded" ? (
														<InlineNote>
															<strong>Recorded grade:</strong>{" "}
															{submission.score === null
																? "no score"
																: `${submission.score} / ${submission.max_points}`}
															{submission.feedback
																? ` — ${submission.feedback}`
																: " — no feedback was left."}
														</InlineNote>
													) : null}

													{canGrade ? (
														<div className="stack--sm">
															<div className="row row--tight">
																<label
																	className="field__label"
																	htmlFor={`${scoreFieldId}-${submission.id}`}
																>
																	Score
																</label>
																<input
																	id={`${scoreFieldId}-${submission.id}`}
																	className="gradebook__input num"
																	inputMode="decimal"
																	min={0}
																	max={maxPoints}
																	placeholder="–"
																	value={scoreValue(row)}
																	disabled={grade.isPending}
																	onChange={(event) =>
																		setScoreDraft((current) => ({
																			...current,
																			[submission.id]: event.target.value,
																		}))
																	}
																/>
																<span className="table__secondary">
																	out of {maxPoints}. Leave it empty to clear
																	the grade.
																</span>
															</div>

															<TextArea
																label="Feedback"
																value={feedbackValue(row)}
																onChange={(value) =>
																	setFeedbackDraft((current) => ({
																		...current,
																		[submission.id]: value,
																	}))
																}
																rows={3}
																placeholder="What worked, what to fix."
																disabled={grade.isPending}
															/>

															<div className="row">
																<Button
																	variant="primary"
																	size="sm"
																	disabled={grade.isPending}
																	onClick={() => requestSave(row)}
																>
																	{submission.status === "graded"
																		? "Replace grade"
																		: "Save grade"}
																</Button>
																{submission.status === "graded" ? (
																	<span className="table__secondary">
																		The student already sees this score; saving
																		replaces it.
																	</span>
																) : null}
															</div>
														</div>
													) : (
														<InlineNote>
															Your role can read submissions but not grade them.
														</InlineNote>
													)}
												</div>
											) : (
												<p className="table__secondary">
													Nothing handed in — there is no answer, file or link
													to read yet.
												</p>
											)}
										</td>
									</tr>
								) : null}
							</Fragment>
						);
					})}
				</tbody>
			</Table>

			<InlineNote>
				Grades entered here are the assignment score. The subject total comes
				from the weighted components on the subject's Grades tab.
			</InlineNote>

			{regrade ? (
				<ConfirmDialog
					title={`Replace ${regrade.row.name}'s grade?`}
					description="The score already recorded for this submission will be overwritten."
					consequences={
						<>
							{regrade.row.name} currently has{" "}
							<strong>{regrade.row.submission?.score ?? "no"}</strong>
							{regrade.row.submission?.score === null ? "" : ` / ${maxPoints}`}{" "}
							on this assignment and has already been shown it. Saving replaces
							it with{" "}
							<strong>
								{regrade.score === null ? "no score" : regrade.score}
								{regrade.score === null ? "" : ` / ${maxPoints}`}
							</strong>
							.
						</>
					}
					confirmLabel="Replace grade"
					successMessage="Grade replaced"
					onConfirm={() =>
						saveGrade(regrade.row, regrade.score, regrade.feedback)
					}
					onClose={() => setRegrade(null)}
				/>
			) : null}
		</Card>
	);
}
