import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { type Assignment, errorMessage } from "../../api";
import { firstError, parseInteger } from "../../form";
import { fromDateTimeLocal, toDateTimeLocal } from "../../format";
import { useAssignmentMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, SelectField, TextArea, TextField } from "../ui";
import { WeekField } from "./WeekField";

/** Add or edit an assignment: due date, points and how students hand it in. */
export function AssignmentFormDialog({
	subjectId,
	assignment,
	onClose,
}: {
	subjectId: string;
	assignment?: Assignment;
	onClose: () => void;
}) {
	const { create, update } = useAssignmentMutations(subjectId);
	const isEdit = assignment !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			title: assignment?.title ?? "",
			description: assignment?.description ?? "",
			due_at: assignment?.due_at ? toDateTimeLocal(assignment.due_at) : "",
			max_points: assignment ? String(assignment.max_points) : "100",
			submission_type: assignment?.submission_type ?? "both",
			allow_late: assignment?.allow_late ?? true,
			week_id: assignment?.week_id ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const input = {
				title: value.title.trim(),
				description: value.description.trim() || undefined,
				due_at: value.due_at ? fromDateTimeLocal(value.due_at) : undefined,
				max_points: parseInteger(value.max_points) ?? 100,
				submission_type: value.submission_type as "text" | "file" | "both",
				allow_late: value.allow_late,
				// Empty clears the week on edit and leaves it unscheduled on create.
				week_id: value.week_id,
			};
			try {
				if (isEdit) {
					await update.mutateAsync({ id: assignment.id, input });
					toastSuccess("Assignment updated", input.title);
				} else {
					await create.mutateAsync({ subjectId, input });
					toastSuccess("Assignment added", input.title);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(error, "Assignment could not be saved");
			}
		},
	});

	const pending = create.isPending || update.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit assignment" : "Add assignment"}
			description="Assignments carry a deadline, a score and a hand-in method."
			onDismiss={onClose}
			dismissible={!pending}
			footer={
				<>
					{serverError ? (
						<span className="dialog__footer-spacer form-note">
							{serverError}
						</span>
					) : null}
					<Button variant="secondary" onClick={onClose} disabled={pending}>
						Cancel
					</Button>
					<form.Subscribe
						selector={(state) =>
							[state.canSubmit, state.isSubmitting, state.values.title] as const
						}
					>
						{([canSubmit, isSubmitting, title]) => (
							<Button
								type="submit"
								form="assignment-form"
								variant="primary"
								disabled={
									!canSubmit || !title.trim() || isSubmitting || pending
								}
								icon={
									isSubmitting || pending ? (
										<CircleNotch
											size={14}
											weight="bold"
											className="spinner"
											aria-hidden="true"
										/>
									) : null
								}
							>
								{isEdit ? "Save assignment" : "Add assignment"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="assignment-form"
				className="stack--sm"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field
					name="title"
					validators={{
						onChange: ({ value }) =>
							value.trim() ? undefined : "Enter an assignment title.",
					}}
				>
					{(field) => (
						<TextField
							label="Title"
							value={field.state.value}
							onChange={(next) => {
								setServerError(null);
								field.handleChange(next);
							}}
							onBlur={() => field.handleBlur()}
							error={
								field.state.meta.isDirty
									? firstError(field.state.meta.errors)
									: undefined
							}
							placeholder="Derivative exercises"
							autoFocus
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field name="description">
					{(field) => (
						<TextArea
							label="Instructions"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							hint="Optional. What the student has to hand in."
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field name="due_at">
					{(field) => (
						<TextField
							label="Due"
							type="datetime-local"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							hint="Optional. Late work follows the deadline policy below."
							disabled={pending}
						/>
					)}
				</form.Field>

				<div className="grid grid--2">
					<form.Field
						name="max_points"
						validators={{
							onChange: ({ value }) => {
								const points = parseInteger(value);
								if (points === null) return "Use a whole number of points.";
								return points > 0 ? undefined : "Use at least 1 point.";
							},
						}}
					>
						{(field) => (
							<TextField
								label="Max points"
								type="number"
								min={1}
								inputMode="numeric"
								value={field.state.value}
								onChange={(next) => field.handleChange(next)}
								onBlur={() => field.handleBlur()}
								error={
									field.state.meta.isDirty
										? firstError(field.state.meta.errors)
										: undefined
								}
								disabled={pending}
							/>
						)}
					</form.Field>

					<form.Field name="submission_type">
						{(field) => (
							<SelectField
								label="Hand-in"
								value={field.state.value}
								onChange={(next) =>
									field.handleChange(next as "both" | "text" | "file")
								}
								options={[
									{ value: "both", label: "Text or file" },
									{ value: "text", label: "Text only" },
									{ value: "file", label: "File only" },
								]}
								hint="How students hand the work in."
								disabled={pending}
							/>
						)}
					</form.Field>
				</div>

				<form.Field name="allow_late">
					{(field) => (
						<SelectField
							label="Late submissions"
							value={field.state.value ? "yes" : "no"}
							onChange={(next) => field.handleChange(next === "yes")}
							options={[
								{ value: "yes", label: "Accept late work (marked late)" },
								{ value: "no", label: "Close at the deadline" },
							]}
							disabled={pending}
						/>
					)}
				</form.Field>
				<form.Field name="week_id">
					{(field) => (
						<WeekField
							subjectId={subjectId}
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							disabled={pending}
						/>
					)}
				</form.Field>
			</form>
		</Dialog>
	);
}
