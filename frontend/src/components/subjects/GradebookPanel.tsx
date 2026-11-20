import {
	ArrowSquareOut,
	Check,
	CircleNotch,
	LinkSimple,
	Plus,
	Trash,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { type Assignment, errorMessage, type Gradebook } from "../../api";
import { parseInteger } from "../../form";
import { formatDateTime } from "../../format";
import { useGradebook, useGradebookMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import {
	Badge,
	Button,
	Card,
	Dialog,
	EmptyState,
	ErrorState,
	InlineNote,
	type PageSize,
	Pagination,
	SearchField,
	SegmentedFilter,
	SelectField,
	SkeletonStack,
	Table,
	Td,
	TextField,
	Th,
} from "../ui";

/**
 * Lecturer gradebook: define the weighted components once, then type points
 * per student. Totals and the 4-10 grade are computed by the backend, so the
 * numbers here always match what the student sees.
 *
 * A component is either an existing assignment (its name, points and edits
 * follow the assignment) or a manual item the lecturer adds — midterm, final,
 * project, engagement.
 */
export function GradebookPanel({
	subjectId,
	userId,
	canManage,
	assignments = [],
}: {
	subjectId: string;
	userId: string;
	canManage: boolean;
	/** The subject's assignments, offered as ready-made graded items. */
	assignments?: Assignment[];
}) {
	const gradebook = useGradebook(subjectId, userId);
	const { createComponent, deleteComponent, saveEntry } =
		useGradebookMutations(subjectId);
	const [draft, setDraft] = useState<Record<string, string>>({});
	const [adding, setAdding] = useState<AddMode | null>(null);
	const [removing, setRemoving] = useState<{
		id: string;
		name: string;
	} | null>(null);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<StatusFilter>("all");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<PageSize>(25);

	const data: Gradebook | undefined = gradebook.data;

	const weightTotal = useMemo(
		() =>
			(data?.components ?? []).reduce(
				(sum, component) => sum + component.weight_percent,
				0,
			),
		[data],
	);

	// Assignments that are not already a graded item — those are what the
	// "from an assignment" picker can offer.
	const linkedAssignments = useMemo(
		() =>
			new Set(
				(data?.components ?? [])
					.map((component) => component.assignment_id)
					.filter((id): id is string => Boolean(id)),
			),
		[data],
	);
	const availableAssignments = useMemo(
		() =>
			assignments.filter((assignment) => !linkedAssignments.has(assignment.id)),
		[assignments, linkedAssignments],
	);

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		return (data?.students ?? []).filter((student) => {
			if (
				query &&
				!student.name.toLowerCase().includes(query) &&
				!student.email.toLowerCase().includes(query)
			) {
				return false;
			}
			const complete = student.coverage >= 1;
			switch (status) {
				case "incomplete":
					return !complete;
				case "passing":
					return complete && student.is_passing;
				case "failing":
					return complete && !student.is_passing;
				default:
					return true;
			}
		});
	}, [data, search, status]);

	const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
	const currentPage = Math.min(page, pageCount);
	const visible = filtered.slice(
		(currentPage - 1) * pageSize,
		currentPage * pageSize,
	);

	if (gradebook.isPending) {
		return (
			<Card>
				<SkeletonStack rows={6} />
			</Card>
		);
	}

	if (gradebook.isError) {
		return (
			<Card>
				<ErrorState
					title="Gradebook could not be loaded"
					message={errorMessage(gradebook.error)}
					onRetry={() => void gradebook.refetch()}
				/>
			</Card>
		);
	}

	if (!data) return null;

	const cellValue = (componentId: string, studentId: string): string => {
		const key = `${componentId}:${studentId}`;
		if (key in draft) return draft[key];
		const points = data.students.find((student) => student.id === studentId)
			?.points[componentId];
		return points === null || points === undefined ? "" : String(points);
	};

	const commit = async (
		componentId: string,
		studentId: string,
		raw: string,
	) => {
		const key = `${componentId}:${studentId}`;
		const trimmed = raw.trim();
		const points = trimmed === "" ? null : parseInteger(trimmed);

		if (trimmed !== "" && points === null) {
			toastApiError(
				new Error("Points must be a whole number."),
				"Points not saved",
			);
			return;
		}

		try {
			await saveEntry.mutateAsync({
				componentId,
				studentId,
				input: { points },
			});
			setDraft((current) => {
				const next = { ...current };
				delete next[key];
				return next;
			});
		} catch (error) {
			toastApiError(error, "Points could not be saved");
		}
	};

	return (
		<>
			{data.components.length === 0 ? (
				<Card>
					<EmptyState
						icon={Plus}
						title="No grade components yet"
						description="Build the final grade from work the subject already has: pick an assignment and its points come along, or add a manual item such as the midterm and the final. Weights are normalised, so 40/50/10 or 4/5/1 both work."
						action={
							canManage ? (
								<AddComponentButtons
									canUseAssignment={availableAssignments.length > 0}
									onPick={setAdding}
								/>
							) : null
						}
					/>
				</Card>
			) : (
				<Card className="card--flush">
					<div className="gradebook__toolbar">
						<span className="row row--tight">
							<Badge tone={weightTotal === 100 ? "success" : "warning"}>
								Weights: {weightTotal}%
							</Badge>
							<span className="card__hint">
								{weightTotal === 100
									? "A full grade is available once every component has points."
									: "Weights do not add up to 100 — totals are still normalised."}
							</span>
						</span>
						{canManage ? (
							<AddComponentButtons
								canUseAssignment={availableAssignments.length > 0}
								onPick={setAdding}
							/>
						) : null}
					</div>

					<div className="list-toolbar">
						<SearchField
							label="Search students"
							placeholder="Search by name or email"
							value={search}
							onChange={(value) => {
								setSearch(value);
								setPage(1);
							}}
						/>
						<SegmentedFilter
							label="Filter by status"
							value={status}
							options={STATUS_OPTIONS}
							onChange={(value) => {
								setStatus(value);
								setPage(1);
							}}
						/>
					</div>

					{filtered.length === 0 ? (
						<EmptyState
							icon={Plus}
							title={
								search
									? `No students match “${search}”`
									: "No students in this view"
							}
							description="Try another name or a different status filter."
						/>
					) : (
						<Table caption="Gradebook">
							<thead>
								<tr>
									<Th>Student</Th>
									{data.components.map((component) => (
										<Th key={component.id} align="right">
											<span className="gradebook__head">
												<span>{component.name}</span>
												{component.assignment_id ? (
													<Link
														to="/assignments/$assignmentId"
														params={{ assignmentId: component.assignment_id }}
														className="gradebook__linked"
														title="Points come from this assignment's submissions"
														aria-label={`Open the assignment behind ${component.name}`}
													>
														<ArrowSquareOut
															size={12}
															weight="bold"
															aria-hidden="true"
														/>
													</Link>
												) : null}
												<span className="gradebook__weight num">
													{component.weight_percent}%
												</span>
												{canManage ? (
													<button
														type="button"
														className="gradebook__remove"
														aria-label={`Remove ${component.name}`}
														disabled={deleteComponent.isPending}
														onClick={() =>
															setRemoving({
																id: component.id,
																name: component.name,
															})
														}
													>
														<Trash
															size={12}
															weight="regular"
															aria-hidden="true"
														/>
													</button>
												) : null}
											</span>
										</Th>
									))}
									<Th align="right">Total</Th>
									<Th align="right">Grade</Th>
								</tr>
							</thead>
							<tbody>
								{visible.map((student) => (
									<tr key={student.id}>
										<Td>
											<span className="table__primary gradebook__student">
												{student.name}
											</span>
											<span className="table__secondary">{student.email}</span>
										</Td>
										{data.components.map((component) => (
											<Td key={component.id} align="right">
												<input
													className="gradebook__input num"
													inputMode="numeric"
													aria-label={`${student.name} — ${component.name}`}
													value={cellValue(component.id, student.id)}
													max={component.max_points}
													disabled={!canManage}
													placeholder="–"
													onChange={(event) =>
														setDraft((current) => ({
															...current,
															[`${component.id}:${student.id}`]:
																event.target.value,
														}))
													}
													onBlur={(event) => {
														const key = `${component.id}:${student.id}`;
														if (!(key in draft)) return;
														void commit(
															component.id,
															student.id,
															event.target.value,
														);
													}}
													onKeyDown={(event) => {
														if (event.key === "Enter")
															event.currentTarget.blur();
													}}
												/>
											</Td>
										))}
										<Td align="right">
											<span className="num">
												{student.total_points === null
													? "–"
													: student.total_points.toFixed(2)}
											</span>
										</Td>
										<Td align="right">
											<span className="row row--tight">
												<span className="num">{student.grade ?? "–"}</span>
												{student.coverage < 1 ? (
													<Badge tone="outline">
														{Math.round(student.coverage * 100)}%
													</Badge>
												) : student.is_passing ? (
													<Badge tone="success">pass</Badge>
												) : (
													<Badge tone="error">fail</Badge>
												)}
											</span>
										</Td>
									</tr>
								))}
							</tbody>
						</Table>
					)}

					<Pagination
						page={currentPage}
						pageSize={pageSize}
						total={filtered.length}
						itemLabel="students"
						onPageChange={setPage}
						onPageSizeChange={(size) => {
							setPageSize(size);
							setPage(1);
						}}
					/>

					<InlineNote>
						Points are saved as you leave a cell. The student sees the weight,
						the points and the running total immediately; the official grade
						stays with the exam office.
					</InlineNote>
				</Card>
			)}

			{removing ? (
				<Dialog
					title={`Delete “${removing.name}”?`}
					description="All points entered for this component will be deleted for every student, and totals will be recalculated. This cannot be undone."
					onDismiss={() => setRemoving(null)}
					dismissible={!deleteComponent.isPending}
					footer={
						<>
							<Button
								variant="secondary"
								onClick={() => setRemoving(null)}
								disabled={deleteComponent.isPending}
							>
								Cancel
							</Button>
							<Button
								variant="danger"
								disabled={deleteComponent.isPending}
								onClick={async () => {
									try {
										await deleteComponent.mutateAsync({ id: removing.id });
										toastSuccess("Component deleted", removing.name);
										setRemoving(null);
									} catch (error) {
										toastApiError(error, "Component could not be deleted");
									}
								}}
							>
								Delete component
							</Button>
						</>
					}
				>
					{null}
				</Dialog>
			) : null}

			{adding ? (
				<ComponentDialog
					initialMode={adding}
					assignments={availableAssignments}
					onClose={() => setAdding(null)}
					pending={createComponent.isPending}
					onSave={async (input) => {
						await createComponent.mutateAsync({ subjectId, input });
						toastSuccess(
							input.assignment_id
								? "Assignment added to the grade"
								: "Component added",
							input.assignment_id
								? "Its points count towards the final grade from now on."
								: input.name,
						);
						setAdding(null);
					}}
				/>
			) : null}
		</>
	);
}

/** The two shapes a graded item can take. */
type AddMode = "assignment" | "manual";

/**
 * Entry points for a new graded item: take an assignment the subject already
 * has, or add a one-off exam item by hand.
 */
function AddComponentButtons({
	canUseAssignment,
	onPick,
}: {
	canUseAssignment: boolean;
	onPick: (mode: AddMode) => void;
}) {
	return (
		<span className="gradebook__add">
			<Button
				variant="primary"
				size="sm"
				icon={<LinkSimple size={15} weight="bold" aria-hidden="true" />}
				disabled={!canUseAssignment}
				title={
					canUseAssignment
						? "Grade an assignment the subject already has"
						: "Every assignment of this subject already counts towards the grade"
				}
				onClick={() => onPick("assignment")}
			>
				Use an assignment
			</Button>
			<Button
				variant="secondary"
				size="sm"
				icon={<Plus size={15} weight="bold" aria-hidden="true" />}
				onClick={() => onPick("manual")}
			>
				Add exam
			</Button>
		</span>
	);
}

type StatusFilter = "all" | "incomplete" | "passing" | "failing";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "incomplete", label: "Missing points" },
	{ value: "passing", label: "Passing" },
	{ value: "failing", label: "Failing" },
];

const MANUAL_TYPES: { value: string; label: string }[] = [
	{ value: "midterm", label: "Midterm" },
	{ value: "final", label: "Final" },
	{ value: "project", label: "Project" },
	{ value: "engagement", label: "Engagement" },
	{ value: "other", label: "Other" },
];

function ComponentDialog({
	initialMode,
	assignments,
	onClose,
	onSave,
	pending,
}: {
	initialMode: AddMode;
	/** Assignments that are not a graded item yet. */
	assignments: Assignment[];
	onClose: () => void;
	pending: boolean;
	onSave: (input: {
		name?: string;
		type?: string;
		weight_percent: number;
		max_points?: number;
		assignment_id?: string;
	}) => Promise<void>;
}) {
	const [mode, setMode] = useState<AddMode>(initialMode);
	const [assignmentId, setAssignmentId] = useState("");
	const [name, setName] = useState("");
	const [type, setType] = useState("midterm");
	const [weight, setWeight] = useState("40");
	const [maxPoints, setMaxPoints] = useState("100");
	const [error, setError] = useState<string | null>(null);

	const selected =
		assignments.find((assignment) => assignment.id === assignmentId) ?? null;

	const switchMode = (next: AddMode) => {
		setMode(next);
		setError(null);
	};

	const submit = async () => {
		const weightPercent = parseInteger(weight);
		if (weightPercent === null || weightPercent < 0 || weightPercent > 100) {
			setError("Weight must be a whole number between 0 and 100.");
			return;
		}

		if (mode === "assignment") {
			if (!selected) {
				setError("Pick the assignment this grade comes from.");
				return;
			}
			setError(null);
			try {
				await onSave({
					assignment_id: selected.id,
					weight_percent: weightPercent,
				});
			} catch (caught) {
				setError(errorMessage(caught));
			}
			return;
		}

		const points = parseInteger(maxPoints);
		if (points === null || points <= 0) {
			setError("Max points must be a positive whole number.");
			return;
		}
		const label =
			name.trim() ||
			MANUAL_TYPES.find((option) => option.value === type)?.label ||
			"Exam";
		setError(null);
		try {
			await onSave({
				name: label,
				type,
				weight_percent: weightPercent,
				max_points: points,
			});
		} catch (caught) {
			setError(errorMessage(caught));
		}
	};

	return (
		<Dialog
			title={
				mode === "assignment" ? "Grade an assignment" : "Add a graded item"
			}
			description={
				mode === "assignment"
					? "The assignment keeps its own points and its own grading page. Everything you grade there lands in this gradebook."
					: "A one-off item such as the midterm, the final, a project or engagement. You type its points by hand."
			}
			onDismiss={onClose}
			dismissible={!pending}
			size={mode === "assignment" ? "lg" : "md"}
			footer={
				<>
					{error ? (
						<span className="dialog__footer-spacer form-note">{error}</span>
					) : null}
					<Button variant="secondary" onClick={onClose} disabled={pending}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={() => void submit()}
						disabled={pending}
						icon={
							pending ? (
								<CircleNotch
									size={14}
									weight="bold"
									className="spinner"
									aria-hidden="true"
								/>
							) : null
						}
					>
						Add to grade
					</Button>
				</>
			}
		>
			<div className="stack--sm">
				<SegmentedFilter
					label="Where the grade comes from"
					value={mode}
					options={[
						{ value: "assignment", label: "From an assignment" },
						{ value: "manual", label: "Manual exam" },
					]}
					onChange={switchMode}
				/>

				{mode === "assignment" ? (
					assignments.length === 0 ? (
						<InlineNote>
							Every assignment of this subject already counts towards the grade.
							Add another assignment on the Assignments tab, or add a manual
							exam item such as the midterm.
						</InlineNote>
					) : (
						<>
							<div
								className="grade-picker"
								role="radiogroup"
								aria-label="Assignment to grade"
							>
								{assignments.map((assignment) => {
									const active = assignment.id === assignmentId;
									return (
										<button
											key={assignment.id}
											type="button"
											role="radio"
											aria-checked={active}
											className={[
												"grade-picker__option",
												active ? "grade-picker__option--active" : "",
											]
												.filter(Boolean)
												.join(" ")}
											disabled={pending}
											onClick={() => {
												setAssignmentId(assignment.id);
												setError(null);
											}}
										>
											<span className="grade-picker__check" aria-hidden="true">
												{active ? <Check size={11} weight="bold" /> : null}
											</span>
											<span className="grade-picker__text">
												<span className="grade-picker__title">
													{assignment.title}
												</span>
												<span className="grade-picker__meta num">
													{assignment.max_points} pts
													{assignment.due_at
														? ` · due ${formatDateTime(assignment.due_at)}`
														: ""}
												</span>
											</span>
										</button>
									);
								})}
							</div>
							<TextField
								label="Weight"
								type="number"
								min={0}
								inputMode="numeric"
								value={weight}
								onChange={setWeight}
								trailing={<span className="field__suffix">%</span>}
								hint="How much of the final grade this assignment is worth."
								disabled={pending}
							/>
						</>
					)
				) : (
					<>
						<SegmentedFilter
							label="Item type"
							value={type}
							options={MANUAL_TYPES}
							onChange={setType}
						/>
						<TextField
							label="Name"
							value={name}
							onChange={setName}
							placeholder={
								MANUAL_TYPES.find((option) => option.value === type)?.label ??
								"Midterm"
							}
							hint="Leave it empty to use the type as the name."
							autoFocus
							disabled={pending}
						/>
						<div className="grid grid--2">
							<TextField
								label="Weight"
								type="number"
								min={0}
								inputMode="numeric"
								value={weight}
								onChange={setWeight}
								trailing={<span className="field__suffix">%</span>}
								disabled={pending}
							/>
							<TextField
								label="Max points"
								type="number"
								min={1}
								inputMode="numeric"
								value={maxPoints}
								onChange={setMaxPoints}
								hint="Graded out of these points."
								disabled={pending}
							/>
						</div>
					</>
				)}
			</div>
		</Dialog>
	);
}
