import { X } from "@phosphor-icons/react";
import {
	type KeyboardEvent,
	type ReactNode,
	type Ref,
	useId,
	useImperativeHandle,
	useState,
} from "react";

/**
 * Extensions an upload never accepts, whatever the allow-list says.
 *
 * Mirrors `submissionBlockedTypes` in the backend (internal/handler/
 * submission_files.go): markup a browser would run in the app's own origin
 * (html, svg, xml-ish) and executables. The server rejects these at upload
 * time anyway; refusing them here means an administrator never saves a list
 * that looks permissive but silently refuses a file.
 */
export const BLOCKED_FILE_TYPES: ReadonlySet<string> = new Set([
	"html",
	"htm",
	"xhtml",
	"shtml",
	"svg",
	"js",
	"mjs",
	"exe",
	"dll",
	"bat",
	"cmd",
	"com",
	"scr",
	"msi",
	"ps1",
	"sh",
	"bash",
	"zsh",
	"jar",
	"php",
	"asp",
	"aspx",
	"cgi",
	"vbs",
	"wsf",
]);

/** What an extension may look like — the backend's own rule, `[a-z0-9]{1,10}`. */
export const MAX_FILE_TYPE_LENGTH = 10;

const ALNUM = /^[a-z0-9]+$/;
/** A typed or pasted run of extensions: commas and whitespace both split. */
const SEPARATORS = /[,\s]+/;

/** Drops a leading dot, spaces and case: ".DOCX" and " docx " both become "docx". */
function normalizeExtension(raw: string): string {
	return raw.trim().toLowerCase().replace(/^\.+/, "");
}

function sortExtensions(values: string[]): string[] {
	return [...values].sort((a, b) => a.localeCompare(b));
}

export type BadgeInputHandle = {
	/**
	 * Commits whatever is still in the text field, so a form's Save button never
	 * drops a half-typed badge. Returns the resulting list, or `null` when the
	 * text was refused (the inline message says why) and nothing may be saved.
	 */
	flush: () => string[] | null;
};

export type BadgeInputProps = {
	/** Current values: bare, dot-less extensions. Rendered alphabetically. */
	values: string[];
	/** Receives the complete new list, sorted. */
	onChange: (next: string[]) => void;
	/** Field label; it names the input for assistive tech too. */
	label: string;
	/** Reports the uncommitted text, so a form can call it unsaved work. */
	onDraftChange?: (draft: string) => void;
	placeholder?: string;
	/** Static help under the field, shown in place of the default instructions. */
	hint?: ReactNode;
	/** Validation message owned by the form (e.g. "keep at least one type"). */
	error?: string;
	disabled?: boolean;
	/** How many badges the list may hold. */
	max?: number;
	ref?: Ref<BadgeInputHandle>;
};

/**
 * An allow-list editor: extensions are added as badges instead of one
 * comma-separated line, so a typo is visible and removable on its own.
 *
 * Add: Tab, Enter or a comma commits what is typed (a paste of "pdf, docx"
 * splits too). Remove: the × on a badge, or Backspace on an empty field.
 * Input that could never be a file type — or is blocked for security — is
 * refused with the reason inline and stays in the field so it can be fixed.
 */
export function BadgeInput({
	values,
	onChange,
	label,
	onDraftChange,
	placeholder = "Add a file type…",
	hint,
	error,
	disabled = false,
	max = 50,
	ref,
}: BadgeInputProps) {
	const fieldId = useId();
	const hintId = `${fieldId}-hint`;
	const messageId = `${fieldId}-message`;

	const [draft, setDraft] = useState("");
	// Why the last attempt was refused. Cleared as soon as the text changes, so
	// the hint describes the text in the field rather than an older attempt.
	const [refusal, setRefusal] = useState<string | null>(null);

	const ordered = sortExtensions(values);
	const message = refusal ?? error ?? null;

	const editDraft = (next: string) => {
		setDraft(next);
		setRefusal(null);
		onDraftChange?.(next);
	};

	/**
	 * Turns the typed run of extensions into badges. Returns the list as it now
	 * stands, or `null` when nothing was added and something was refused.
	 */
	const commit = (raw: string): string[] | null => {
		const tokens = raw.split(SEPARATORS).filter(Boolean);
		if (tokens.length === 0) {
			setRefusal(null);
			editDraft("");
			return ordered;
		}

		const next = [...ordered];
		let problem: string | null = null;

		for (const token of tokens) {
			const extension = normalizeExtension(token);
			if (!extension) continue;
			if (BLOCKED_FILE_TYPES.has(extension)) {
				problem = `${extension} is blocked for security`;
				continue;
			}
			if (!ALNUM.test(extension)) {
				problem = "Only letters and numbers";
				continue;
			}
			if (extension.length > MAX_FILE_TYPE_LENGTH) {
				problem = `Use ${MAX_FILE_TYPE_LENGTH} characters at most`;
				continue;
			}
			if (next.includes(extension)) {
				problem = `${extension} is already in the list`;
				continue;
			}
			if (next.length >= max) {
				problem = `At most ${max} file types`;
				continue;
			}
			next.push(extension);
		}

		const added = next.length !== ordered.length;
		if (added) onChange(sortExtensions(next));
		// Cleared once it has been used; kept when it was refused, so the text
		// that needs fixing stays visible instead of vanishing.
		editDraft(added ? "" : raw);
		setRefusal(problem);
		return problem && !added ? null : sortExtensions(next);
	};

	useImperativeHandle(ref, () => ({ flush: () => commit(draft) }), [
		draft,
		ordered.join(","),
		max,
	]);

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" || event.key === "Tab") {
			if (!draft.trim()) return; // Empty field: let Tab move on.
			event.preventDefault();
			commit(draft);
			return;
		}
		if (event.key === ",") {
			event.preventDefault();
			commit(draft);
			return;
		}
		if (event.key === "Backspace" && !draft && ordered.length > 0) {
			event.preventDefault();
			const last = ordered[ordered.length - 1];
			onChange(ordered.filter((extension) => extension !== last));
			setRefusal(null);
			return;
		}
		if (event.key === "Escape" && draft) {
			event.stopPropagation();
			editDraft("");
		}
	};

	return (
		<div className="field">
			<div className="field__label-inner">
				<label className="field__label" htmlFor={fieldId}>
					{label}
				</label>
				<span className="field__counter num">
					{ordered.length}/{max}
				</span>
			</div>

			{/*
			 * Leaving the whole group — not just the text field — commits what is
			 * typed, so nothing is silently dropped when focus goes to the size
			 * field. Focus moving between the badges and the field stays inside
			 * the group, so removing a badge never swallows the draft.
			 */}
			<div
				className="traits"
				onBlur={(event) => {
					if (event.currentTarget.contains(event.relatedTarget)) return;
					commit(draft);
				}}
			>
				{ordered.map((extension) => (
					<button
						key={extension}
						type="button"
						className="trait-chip trait-chip--on"
						title={`Remove ${extension}`}
						aria-label={`Remove ${extension}`}
						disabled={disabled}
						onClick={() =>
							onChange(ordered.filter((entry) => entry !== extension))
						}
					>
						{extension}
						<X size={11} weight="bold" aria-hidden="true" />
					</button>
				))}
				<input
					id={fieldId}
					className="input trait-input"
					value={draft}
					placeholder={placeholder}
					disabled={disabled}
					aria-invalid={Boolean(message)}
					aria-describedby={message ? `${hintId} ${messageId}` : hintId}
					autoComplete="off"
					spellCheck={false}
					onChange={(event) => editDraft(event.target.value)}
					onKeyDown={onKeyDown}
				/>
			</div>

			<p className="field__description" id={hintId}>
				{hint ??
					"Press Tab, Enter or comma to add one. Backspace on an empty field removes the last."}
			</p>

			{message ? (
				<p className="form-note" id={messageId} role="alert">
					{message}
				</p>
			) : null}
		</div>
	);
}
