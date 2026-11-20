import {
	CheckCircle,
	CircleNotch,
	LinkSimple,
	Trash,
	WarningCircle,
} from "@phosphor-icons/react";
import { useState } from "react";
import type { Assignment, Submission } from "../../api";
import { formatDateTime, humanize } from "../../format";
import {
	useAssignmentMutations,
	useDeleteSubmissionFile,
	useGeneralSettings,
	useUploadSubmissionFile,
} from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { ConfirmDialog } from "../ConfirmDialog";
import {
	Badge,
	Button,
	Card,
	InlineNote,
	Skeleton,
	TextArea,
	TextField,
} from "../ui";
import { SubmissionFileField } from "./SubmissionFileField";
import { SubmissionFileLink } from "./SubmissionFileLink";

/**
 * The student's side of one assignment: what is handed in, what it scored, and
 * the form that hands the work in or replaces it.
 *
 * Everything the assignment's `submission_type` allows is offered, and nothing
 * more: a written answer, a stored file, or both. The legacy pasted share link
 * (`file_url`) stays usable next to the uploader — past hand-ins still carry one
 * — and a link with no stored file is offered as an external link.
 */
export function StudentSubmissionPanel({
	assignmentId,
	subjectId,
	assignment,
	submission,
	closed,
}: {
	assignmentId: string;
	subjectId?: string;
	assignment: Assignment;
	submission?: Submission;
	/** The deadline has passed and the lecturer refuses late hand-ins. */
	closed: boolean;
}) {
	const settings = useGeneralSettings();
	const upload = useUploadSubmissionFile();
	const deleteFile = useDeleteSubmissionFile();
	const { submit } = useAssignmentMutations(subjectId);

	const [content, setContent] = useState("");
	const [fileUrl, setFileUrl] = useState("");
	const [picked, setPicked] = useState<File | null>(null);
	const [removingFile, setRemovingFile] = useState(false);

	const takesText = assignment.submission_type !== "file";
	const takesFile = assignment.submission_type !== "text";
	const graded = submission?.status === "graded";
	const pending = upload.isPending || submit.isPending;

	const link = takesFile ? fileUrl.trim() : "";
	const text = takesText ? content.trim() : "";
	const willUpload = takesFile && picked !== null;
	const willPost = Boolean(link || text);
	const canSend = !graded && !closed && !pending && (willUpload || willPost);

	/**
	 * The upload goes first, then the text.
	 *
	 * Order is not cosmetic: PUT /submission/file is what creates the submission
	 * row the first time a student hands anything in, so uploading first means
	 * the POST that follows always takes the update path. It also keeps a
	 * refusal honest — if the server rejects the file (too big, wrong kind,
	 * already graded) the written answer has not been saved yet, so a student is
	 * never told their text went in while their file did not. A 409 from the
	 * upload (already graded) stops the pair before either half lands.
	 */
	const handIn = async () => {
		try {
			if (willUpload && picked) {
				await upload.mutateAsync({ assignmentId, file: picked });
			}
			if (willPost) {
				await submit.mutateAsync({
					assignmentId,
					input: {
						content: text || undefined,
						file_url: link || undefined,
					},
				});
			}
			toastSuccess(
				willUpload ? "File handed in" : "Submission saved",
				assignment.title,
			);
			setContent("");
			setFileUrl("");
			setPicked(null);
		} catch (error) {
			// The API's own text wins: "the file's contents do not match its .pdf
			// extension" is the only sentence that tells the student what to fix.
			toastApiError(error, "Hand-in failed");
		}
	};

	const statusTone =
		submission?.status === "graded"
			? "success"
			: submission?.status === "late"
				? "warning"
				: "primary";

	return (
		<Card className="card--padded">
			<h2 className="card__title">Your submission</h2>

			{submission ? (
				<div className="stack--sm">
					<p className="row row--tight">
						<Badge tone={statusTone}>{humanize(submission.status)}</Badge>
						{submission.score === null ? (
							<span className="table__secondary">Not graded yet</span>
						) : (
							<span className="num">
								{submission.score} / {submission.max_points}
							</span>
						)}
					</p>
					<p className="content-row__meta">
						Handed in{" "}
						<span className="num">
							{formatDateTime(submission.submitted_at)}
						</span>
						{submission.graded_at ? (
							<>
								{" · graded "}
								<span className="num">
									{formatDateTime(submission.graded_at)}
								</span>
							</>
						) : null}
					</p>

					{submission.file_name ? (
						<div className="stack--sm">
							<SubmissionFileLink submission={submission} />
							{graded || closed ? null : (
								<div className="row">
									<Button
										variant="ghost"
										size="sm"
										icon={
											<Trash size={13} weight="regular" aria-hidden="true" />
										}
										onClick={() => setRemovingFile(true)}
										disabled={pending}
									>
										Remove file
									</Button>
								</div>
							)}
						</div>
					) : null}

					{submission.file_url ? (
						<p className="row row--tight">
							<LinkSimple size={13} weight="regular" aria-hidden="true" />
							<a
								href={submission.file_url}
								target="_blank"
								rel="noreferrer"
								title={submission.file_url}
							>
								{submission.file_name ? "Shared link" : "Your shared link"}
							</a>
						</p>
					) : null}

					{submission.content ? (
						<p className="content-row__body">{submission.content}</p>
					) : null}

					{submission.feedback ? (
						<InlineNote>
							<strong>Feedback:</strong> {submission.feedback}
						</InlineNote>
					) : null}
				</div>
			) : (
				<p className="content-row__body">
					Nothing handed in yet.
					{closed ? " The deadline has passed." : null}
				</p>
			)}

			{graded ? (
				<InlineNote>
					This submission is graded, so it can no longer be changed.
				</InlineNote>
			) : (
				<div className="stack--sm assignment-form">
					{takesText ? (
						<TextArea
							label={submission ? "Replace your answer" : "Your answer"}
							value={content}
							onChange={setContent}
							rows={4}
							placeholder="Write your answer here."
							disabled={pending || closed}
						/>
					) : null}

					{takesFile ? (
						<>
							{settings.isPending ? (
								<Skeleton width="100%" />
							) : (
								<SubmissionFileField
									settings={settings.data}
									picked={picked}
									onPick={setPicked}
									onClear={() => setPicked(null)}
									disabled={pending || closed}
								/>
							)}
							<TextField
								label="Or paste a share link"
								value={fileUrl}
								onChange={setFileUrl}
								placeholder="https://drive.example.com/my-work.pdf"
								hint={
									takesText
										? "Optional, if the work lives somewhere else. The upload above is stored with your submission."
										: "Paste a link when you cannot attach the file here. A stored file still takes priority."
								}
								disabled={pending || closed}
							/>
						</>
					) : null}

					<div className="row">
						<Button
							variant="primary"
							disabled={!canSend}
							icon={
								pending ? (
									<CircleNotch
										size={14}
										weight="bold"
										className="spinner"
										aria-hidden="true"
									/>
								) : (
									<CheckCircle size={14} weight="bold" aria-hidden="true" />
								)
							}
							onClick={() => void handIn()}
						>
							{pending
								? upload.isPending
									? "Uploading…"
									: "Saving…"
								: submission
									? "Save changes"
									: willUpload
										? "Hand in file"
										: "Hand in"}
						</Button>
					</div>

					{closed ? (
						<p className="form-note">
							<WarningCircle size={13} weight="regular" aria-hidden="true" />{" "}
							The deadline passed and the lecturer closed late hand-ins.
						</p>
					) : null}
				</div>
			)}

			{removingFile && submission ? (
				<ConfirmDialog
					title="Remove the attached file?"
					description="The file is deleted from your submission."
					consequences={
						<>
							“{submission.file_name}” will be removed. Your submission and its
							status stay, and you can attach a replacement until the deadline.
						</>
					}
					confirmLabel="Remove file"
					successMessage="File removed"
					onConfirm={() => deleteFile.mutateAsync(assignmentId)}
					onClose={() => setRemovingFile(false)}
				/>
			) : null}
		</Card>
	);
}
