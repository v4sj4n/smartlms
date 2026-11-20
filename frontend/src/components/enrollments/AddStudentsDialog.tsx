import {
	Check,
	CircleNotch,
	UserPlus,
	UsersThree,
} from "@phosphor-icons/react";
import { useState } from "react";
import { ApiError, errorMessage, type StudentRow } from "../../api";
import { useAuth } from "../../auth";
import { useEnrollStudents, useStudents } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import {
	Button,
	Dialog,
	EmptyState,
	ErrorState,
	InlineNote,
	Pagination,
	SearchField,
	SkeletonStack,
} from "../ui";

/** One page of the directory; the dialog is a picker, not a browsing screen. */
const PAGE_SIZE = 8;

/**
 * A student in the picker: the whole row is the checkbox, the way the gradebook
 * picks an assignment. Somebody already on the roster stays visible but cannot
 * be picked, so a search that finds only roster members says so instead of
 * silently showing nothing.
 */
function StudentOption({
	student,
	enrolled,
	selected,
	onToggle,
	disabled,
}: {
	student: StudentRow;
	enrolled: boolean;
	selected: boolean;
	onToggle: () => void;
	disabled: boolean;
}) {
	const checked = enrolled || selected;
	return (
		<button
			type="button"
			role="checkbox"
			aria-checked={checked}
			className={[
				"grade-picker__option",
				checked ? "grade-picker__option--active" : "",
			]
				.filter(Boolean)
				.join(" ")}
			disabled={enrolled || disabled}
			onClick={onToggle}
		>
			<span className="grade-picker__check" aria-hidden="true">
				{checked ? <Check size={11} weight="bold" /> : null}
			</span>
			<span className="grade-picker__text">
				<span className="grade-picker__title">{student.name}</span>
				<span className="grade-picker__meta">
					{enrolled
						? `${student.email} · already on the roster`
						: student.email}
				</span>
			</span>
		</button>
	);
}

/**
 * Bulk enrolment for one subject: search the student directory, tick people,
 * enrol them in one request. The API is all-or-nothing, so its own message is
 * shown in the dialog when a pick is refused instead of a generic failure.
 *
 * The directory itself is an administrator surface (GET /api/students asks for
 * users.view): a lecturer who runs the subject can still see and edit the
 * roster, but cannot search the directory, so that case gets a plain note
 * rather than a raw error.
 */
export function AddStudentsDialog({
	subjectId,
	subjectName,
	enrolledIds,
	onClose,
}: {
	subjectId: string;
	subjectName: string;
	/** Students already on the roster: shown, but not selectable. */
	enrolledIds: Set<string>;
	onClose: () => void;
}) {
	const { hasPermission } = useAuth();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<string[]>([]);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const directory = useStudents({ page, page_size: PAGE_SIZE, search });
	const enroll = useEnrollStudents(subjectId);

	// Decided from the session first so the note is immediate; the 403 branch
	// below covers the API disagreeing (a permission revoked mid-session).
	const forbidden =
		!hasPermission("users.view") ||
		(directory.isError &&
			directory.error instanceof ApiError &&
			directory.error.status === 403);

	const toggle = (studentId: string) => {
		setError(null);
		setSelected((current) =>
			current.includes(studentId)
				? current.filter((id) => id !== studentId)
				: [...current, studentId],
		);
	};

	const submit = async () => {
		if (selected.length === 0) return;
		setPending(true);
		setError(null);
		try {
			const roster = await enroll.mutateAsync(selected);
			toastSuccess(
				selected.length === 1
					? "1 student enrolled"
					: `${selected.length} students enrolled`,
				`${subjectName} now has ${roster.enrolled.length} on its roster.`,
			);
			onClose();
		} catch (caught) {
			setError(errorMessage(caught));
			toastApiError(caught, "Students could not be enrolled");
		} finally {
			setPending(false);
		}
	};

	const count = selected.length;
	const enrollLabel =
		count === 0
			? "Enroll students"
			: `Enroll ${count} ${count === 1 ? "student" : "students"}`;

	return (
		<Dialog
			title="Add students"
			description={`Pick the students who take ${subjectName}.`}
			onDismiss={onClose}
			dismissible={!pending}
			footer={
				<>
					<Button variant="secondary" onClick={onClose} disabled={pending}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={() => void submit()}
						disabled={pending || forbidden || count === 0}
						icon={
							pending ? (
								<CircleNotch
									size={14}
									weight="bold"
									className="spinner"
									aria-hidden="true"
								/>
							) : (
								<UserPlus size={15} weight="regular" aria-hidden="true" />
							)
						}
					>
						{enrollLabel}
					</Button>
				</>
			}
		>
			{forbidden ? (
				<InlineNote>
					Searching the student directory needs the <code>users.view</code>{" "}
					permission, which your role does not hold. An administrator can enrol
					students into {subjectName}; you can still take people off the roster.
				</InlineNote>
			) : (
				<>
					<SearchField
						label="Search students"
						placeholder="Search by name or email"
						value={search}
						onChange={(value) => {
							setSearch(value);
							setPage(1);
						}}
					/>

					{directory.isError ? (
						<ErrorState
							title="The student directory could not be loaded"
							message={errorMessage(directory.error)}
							onRetry={() => void directory.refetch()}
						/>
					) : directory.isPending ? (
						<SkeletonStack rows={4} />
					) : directory.data.items.length === 0 ? (
						<EmptyState
							icon={UsersThree}
							title={
								search ? `No students match “${search}”` : "No students to add"
							}
							description={
								search
									? "Try another name or email address."
									: "Student accounts appear here once they are created."
							}
						/>
					) : (
						<div
							className="grade-picker"
							role="group"
							aria-label="Students to enrol"
						>
							{directory.data.items.map((student) => (
								<StudentOption
									key={student.id}
									student={student}
									enrolled={enrolledIds.has(student.id)}
									selected={selected.includes(student.id)}
									disabled={pending}
									onToggle={() => toggle(student.id)}
								/>
							))}
						</div>
					)}

					{directory.data ? (
						<Pagination
							page={page}
							pageSize={PAGE_SIZE}
							total={directory.data.total}
							itemLabel={
								directory.data.total === 1
									? "student account"
									: "student accounts"
							}
							onPageChange={(next) => setPage(Math.max(1, next))}
						/>
					) : null}

					<p className="card__hint">
						Students already on the roster are shown but cannot be picked twice.
					</p>
				</>
			)}

			{error ? (
				<p className="form-note" role="alert">
					{error}
				</p>
			) : null}
		</Dialog>
	);
}
