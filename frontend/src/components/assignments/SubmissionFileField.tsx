import { FileArrowUp, UploadSimple, X } from "@phosphor-icons/react";
import { useId, useRef, useState } from "react";
import type { GeneralSettings } from "../../api";
import { formatBytes } from "../../format";

/**
 * "pdf, docx or zip" -> "PDF, DOCX or ZIP": the sentence a student reads before
 * they pick a file. The list comes from general_settings, never from a constant
 * here, so an administrator tightening the allow-list changes this copy too.
 */
export function allowedTypesLabel(types: string[] | undefined): string {
	const labels = (types ?? []).map((type) => type.toUpperCase());
	if (labels.length === 0) return "the allowed file types";
	if (labels.length === 1) return labels[0];
	return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`;
}

/** The extension of a picked name, lowercased, or "" when it has none. */
function extensionOf(name: string): string {
	const dot = name.lastIndexOf(".");
	if (dot < 0 || dot === name.length - 1) return "";
	return name.slice(dot + 1).toLowerCase();
}

/**
 * The student's file picker, built like the lecture-file field: a hidden input
 * behind a dashed dropzone, and a chip once something is picked.
 *
 * The checks here are the cheap ones — extension, size, empty — so a student is
 * told before a 20 MB round trip. They are not the contract: the server sniffs
 * the bytes against the extension and re-checks the same limits, and its
 * message is toasted by the caller when it refuses.
 */
export function SubmissionFileField({
	settings,
	picked,
	onPick,
	onClear,
	disabled,
}: {
	settings: GeneralSettings | undefined;
	picked: File | null;
	onPick: (file: File) => void;
	onClear: () => void;
	disabled?: boolean;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const labelId = useId();
	const [error, setError] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);

	const allowed = settings?.submission_allowed_file_types ?? [];
	const maxMb = settings?.submission_max_file_mb;
	const maxBytes = maxMb ? maxMb * 1024 * 1024 : null;

	const accept = (file: File | undefined) => {
		if (!file) return;
		const extension = extensionOf(file.name);
		if (!extension) {
			setError("That file has no extension. Name it like worksheet.pdf.");
			return;
		}
		if (allowed.length > 0 && !allowed.includes(extension)) {
			setError(`This assignment takes ${allowedTypesLabel(allowed)} files.`);
			return;
		}
		if (maxBytes !== null && file.size > maxBytes) {
			setError(
				`That file is ${formatBytes(file.size)}; the limit is ${maxMb} MB.`,
			);
			return;
		}
		if (file.size === 0) {
			setError("That file is empty.");
			return;
		}
		setError(null);
		onPick(file);
	};

	return (
		<div className="field" role="group" aria-labelledby={labelId}>
			<span id={labelId} className="field__label">
				Your file
			</span>

			<input
				ref={inputRef}
				type="file"
				accept={
					allowed.length > 0
						? allowed.map((type) => `.${type}`).join(",")
						: undefined
				}
				hidden
				onChange={(event) => {
					accept(event.target.files?.[0]);
					// Reset, so picking the same file twice still fires a change.
					event.target.value = "";
				}}
			/>

			{picked ? (
				<div className="file-chip">
					<span className="file-chip__icon">
						<FileArrowUp size={18} weight="regular" aria-hidden="true" />
					</span>
					<span className="file-chip__text">
						<span className="file-chip__name" title={picked.name}>
							{picked.name}
						</span>
						<span className="file-chip__meta num">
							{extensionOf(picked.name).toUpperCase()} ·{" "}
							{formatBytes(picked.size)} · uploads on hand-in
						</span>
					</span>
					<button
						type="button"
						className="link-button"
						onClick={() => inputRef.current?.click()}
						disabled={disabled}
					>
						Replace
					</button>
					<button
						type="button"
						className="file-chip__remove"
						aria-label={`Discard ${picked.name}`}
						onClick={() => {
							setError(null);
							onClear();
						}}
						disabled={disabled}
					>
						<X size={14} weight="bold" aria-hidden="true" />
					</button>
				</div>
			) : (
				<button
					type="button"
					className={dragging ? "dropzone dropzone--active" : "dropzone"}
					onClick={() => inputRef.current?.click()}
					onDragOver={(event) => {
						event.preventDefault();
						setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={(event) => {
						event.preventDefault();
						setDragging(false);
						accept(event.dataTransfer.files[0]);
					}}
					disabled={disabled}
				>
					<UploadSimple size={18} weight="regular" aria-hidden="true" />
					<span>
						<strong>Choose a file</strong> or drop it here
					</span>
				</button>
			)}

			{error ? (
				<p className="field__error" role="alert">
					{error}
				</p>
			) : (
				<p className="field__description">
					{allowedTypesLabel(allowed)}, up to {maxMb ?? "the allowed"} MB.
				</p>
			)}
		</div>
	);
}
