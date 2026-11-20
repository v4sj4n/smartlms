import {
	FileDoc,
	FilePdf,
	FileText,
	FileZip,
	Image,
} from "@phosphor-icons/react";
import { type Submission, submissionFileUrl } from "../../api";
import { formatBytes } from "../../format";

/**
 * The icon and colour tone for a stored file's kind. `file_kind` is the
 * extension with jpeg folded into jpg, so an unknown or administrator-added
 * extension falls back to the neutral document icon instead of nothing.
 */
function fileKindVisual(kind: string) {
	switch (kind) {
		case "pdf":
			return { Icon: FilePdf, tone: " file-chip__icon--pdf" };
		case "zip":
		case "docx":
		case "pptx":
		case "xlsx":
		case "odt":
		case "ods":
		case "odp":
			return { Icon: FileZip, tone: " file-chip__icon--zip" };
		case "png":
		case "jpg":
		case "gif":
		case "webp":
			return { Icon: Image, tone: "" };
		case "txt":
		case "md":
		case "csv":
			return { Icon: FileText, tone: " file-chip__icon--html" };
		default:
			return { Icon: FileDoc, tone: "" };
	}
}

/**
 * The one way a submission's stored file is offered for download: the same
 * `.file-link` chip the lecture files use. The bytes live behind
 * submissionFileUrl(), authorised by the session cookie on this origin, and the
 * route always answers as an attachment.
 */
export function SubmissionFileLink({
	submission,
	compact = false,
}: {
	submission: Submission;
	/** Drops the name/meta detail, for a table cell that has its own columns. */
	compact?: boolean;
}) {
	if (!submission.file_name) return null;
	const kind = (submission.file_kind ?? "file").toLowerCase();
	const { Icon, tone } = fileKindVisual(kind);

	return (
		<a
			className="file-link"
			href={submissionFileUrl(submission.id)}
			download={submission.file_name}
			title={submission.file_name}
		>
			<span className={`file-chip__icon${tone}`}>
				<Icon size={compact ? 14 : 16} weight="regular" aria-hidden="true" />
			</span>
			<span className="file-link__name">
				{compact ? kind.toUpperCase() : submission.file_name}
			</span>
			{submission.file_size === null ? null : (
				<span className="file-link__meta num">
					{compact ? "" : `${kind.toUpperCase()} · `}
					{formatBytes(submission.file_size)}
				</span>
			)}
			<span className="visually-hidden">(downloads)</span>
		</a>
	);
}
