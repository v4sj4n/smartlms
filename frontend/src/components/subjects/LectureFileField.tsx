import {
	ArrowCounterClockwise,
	FileHtml,
	FilePdf,
	FileZip,
	UploadSimple,
	X,
} from "@phosphor-icons/react";
import { useId, useRef, useState } from "react";
import {
	LECTURE_FILE_EXTENSIONS,
	LECTURE_FILE_MAX_BYTES,
	type LectureFile,
} from "../../api";
import { formatBytes } from "../../format";

type FileKind = LectureFile["type"];

const KIND_ICON = { pdf: FilePdf, html: FileHtml, zip: FileZip } as const;

function kindOf(name: string): FileKind | null {
	const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
	if (!LECTURE_FILE_EXTENSIONS.includes(ext)) return null;
	if (ext === ".pdf") return "pdf";
	if (ext === ".zip") return "zip";
	return "html";
}

/**
 * The lecture's one file: shows what is attached, lets the lecturer pick a
 * PDF, HTML or ZIP to replace it, or mark it for removal. Nothing is sent
 * until the dialog saves; the parent reads `picked` and `removed`.
 */
export function LectureFileField({
	current,
	picked,
	removed,
	onPick,
	onRemove,
	onUndo,
	disabled,
}: {
	current?: LectureFile;
	picked: File | null;
	removed: boolean;
	onPick: (file: File) => void;
	onRemove: () => void;
	onUndo: () => void;
	disabled?: boolean;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const labelId = useId();
	const [error, setError] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);

	const accept = (file: File | undefined) => {
		if (!file) return;
		if (!kindOf(file.name)) {
			setError("Choose a .pdf, .html or .zip file.");
			return;
		}
		if (file.size > LECTURE_FILE_MAX_BYTES) {
			setError(`That file is ${formatBytes(file.size)}; the limit is 50 MB.`);
			return;
		}
		if (file.size === 0) {
			setError("That file is empty.");
			return;
		}
		setError(null);
		onPick(file);
	};

	const shown = picked
		? {
				name: picked.name,
				size: picked.size,
				kind: kindOf(picked.name) ?? "zip",
			}
		: current && !removed
			? { name: current.name, size: current.size, kind: current.type }
			: null;
	const Icon = shown ? KIND_ICON[shown.kind] : null;

	return (
		<div className="field" role="group" aria-labelledby={labelId}>
			<span id={labelId} className="field__label">
				Lecture file
			</span>

			<input
				ref={inputRef}
				type="file"
				accept={LECTURE_FILE_EXTENSIONS.join(",")}
				hidden
				onChange={(event) => {
					accept(event.target.files?.[0]);
					event.target.value = "";
				}}
			/>

			{shown && Icon ? (
				<div className="file-chip">
					<span className={`file-chip__icon file-chip__icon--${shown.kind}`}>
						<Icon size={18} weight="regular" aria-hidden="true" />
					</span>
					<span className="file-chip__text">
						<span className="file-chip__name" title={shown.name}>
							{shown.name}
						</span>
						<span className="file-chip__meta num">
							{shown.kind.toUpperCase()} · {formatBytes(shown.size)}
							{picked ? " · uploads on save" : ""}
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
						aria-label={`Remove ${shown.name}`}
						onClick={() => {
							setError(null);
							onRemove();
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
			) : removed && current && !picked ? (
				<p className="field__description">
					{current.name} will be removed on save.{" "}
					<button
						type="button"
						className="link-button link-button--inline"
						onClick={onUndo}
						disabled={disabled}
					>
						<ArrowCounterClockwise size={12} weight="bold" aria-hidden="true" />{" "}
						Undo
					</button>
				</p>
			) : (
				<p className="field__description">
					Optional. PDF, HTML or ZIP, up to 50 MB.
				</p>
			)}
		</div>
	);
}
