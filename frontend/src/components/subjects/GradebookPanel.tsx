import { CircleNotch, Plus, Trash } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { errorMessage, type Gradebook } from "../../api";
import { parseInteger } from "../../form";
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
 */
export function GradebookPanel({
	subjectId,
	userId,
	canManage,
}: {
	subjectId: string;
	userId: string;
	canManage: boolean;
}) {
	const gradebook = useGradebook(subjectId, userId);
	const { createComponent, deleteComponent, saveEntry } =
		useGradebookMutations(subjectId);
	const [draft, setDraft] = useState<Record<string, string>>({});
	const [adding, setAdding] = useState(false);

	const data: Gradebook | undefined = gradebook.data;

	const weightTotal = useMemo(
		() =>
			(data?.components ?? []).reduce(
				(sum, component) => sum + component.weight_percent,
				0,
			),
		[data],
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
				input: { user_id: userId, points },
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
						description="Add the components that make up the final grade (midterm, final, engagement…) and give each a weight. Weights are normalised, so 40/50/10 or 4/5/1 both work."
						action={
							canManage ? (
								<Button
									variant="primary"
									size="sm"
									onClick={() => setAdding(true)}
								>
									Add component
								</Button>
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
							<Button
								variant="secondary"
								size="sm"
								icon={<Plus size={15} weight="bold" aria-hidden="true" />}
								onClick={() => setAdding(true)}
							>
								Add component
							</Button>
						) : null}
					</div>

					<Table caption="Gradebook">
						<thead>
							<tr>
								<Th>Student</Th>
								{data.components.map((component) => (
									<Th key={component.id} align="right">
										<span className="gradebook__head">
											<span>{component.name}</span>
											<span className="gradebook__weight num">
												{component.weight_percent}%
											</span>
											{canManage ? (
												<button
													type="button"
													className="gradebook__remove"
													aria-label={`Remove ${component.name}`}
													disabled={deleteComponent.isPending}
													onClick={() => {
														void deleteComponent.mutateAsync({
															id: component.id,
															user_id: userId,
														});
													}}
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
							{data.students.map((student) => (
								<tr key={student.id}>
									<Td>
										<span className="table__primary">{student.name}</span>
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
													if (event.key === "Enter") event.currentTarget.blur();
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

					<InlineNote>
						Points are saved as you leave a cell. The student sees the weight,
						the points and the running total immediately; the official grade
						stays with the exam office.
					</InlineNote>
				</Card>
			)}

			{adding ? (
				<ComponentDialog
					subjectId={subjectId}
					userId={userId}
					onClose={() => setAdding(false)}
					pending={createComponent.isPending}
					onSave={async (input) => {
						await createComponent.mutateAsync({
							subjectId,
							input: { user_id: userId, ...input },
						});
						toastSuccess("Component added", input.name);
						setAdding(false);
					}}
				/>
			) : null}
		</>
	);
}

function ComponentDialog({
	onClose,
	onSave,
	pending,
}: {
	subjectId: string;
	userId: string;
	onClose: () => void;
	pending: boolean;
	onSave: (input: {
		name: string;
		type: string;
		weight_percent: number;
		max_points: number;
	}) => Promise<void>;
}) {
	const [name, setName] = useState("");
	const [type, setType] = useState("midterm");
	const [weight, setWeight] = useState("40");
	const [maxPoints, setMaxPoints] = useState("100");
	const [error, setError] = useState<string | null>(null);

	const submit = async () => {
		const weightPercent = parseInteger(weight);
		const points = parseInteger(maxPoints);
		if (!name.trim()) {
			setError("Give the component a name.");
			return;
		}
		if (weightPercent === null || weightPercent < 0 || weightPercent > 100) {
			setError("Weight must be a whole number between 0 and 100.");
			return;
		}
		if (points === null || points <= 0) {
			setError("Max points must be a positive whole number.");
			return;
		}
		setError(null);
		try {
			await onSave({
				name: name.trim(),
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
			title="Add grade component"
			description="Components make up the subject total. Their weights are normalised to 100%."
			onDismiss={onClose}
			dismissible={!pending}
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
						Add component
					</Button>
				</>
			}
		>
			<div className="stack--sm">
				<TextField
					label="Name"
					value={name}
					onChange={setName}
					placeholder="Midterm exam"
					autoFocus
					disabled={pending}
				/>
				<div className="grid grid--2">
					<SelectField
						label="Type"
						value={type}
						onChange={setType}
						options={[
							{ value: "midterm", label: "Midterm" },
							{ value: "final", label: "Final" },
							{ value: "engagement", label: "Engagement" },
							{ value: "coursework", label: "Coursework" },
							{ value: "project", label: "Project" },
							{ value: "other", label: "Other" },
						]}
						disabled={pending}
					/>
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
				</div>
				<TextField
					label="Max points"
					type="number"
					min={1}
					inputMode="numeric"
					value={maxPoints}
					onChange={setMaxPoints}
					hint="Students are graded out of these points; the backend converts to a percentage."
					disabled={pending}
				/>
			</div>
		</Dialog>
	);
}
