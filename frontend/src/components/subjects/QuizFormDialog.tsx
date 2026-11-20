import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { errorMessage, type Quiz } from "../../api";
import { firstError, parseInteger } from "../../form";
import { useSubjectMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, TextField } from "../ui";
import { WeekField } from "./WeekField";

/** Add or edit a quiz: title, description and an optional time limit. */
export function QuizFormDialog({
	subjectId,
	weekId,
	quiz,
	onClose,
}: {
	subjectId: string;
	/** Week this content is filed into on create, when opened from a week. */
	weekId?: string;
	quiz?: Quiz;
	onClose: () => void;
}) {
	const { createQuiz, updateQuiz } = useSubjectMutations(subjectId);
	const isEdit = quiz !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			title: quiz?.title ?? "",
			description: quiz?.description ?? "",
			time_limit_minutes: quiz ? String(quiz.time_limit_minutes) : "",
			week_id: quiz?.week_id ?? weekId ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const minutes = parseInteger(value.time_limit_minutes);
			const input = {
				title: value.title.trim(),
				description: value.description.trim() || undefined,
				time_limit_minutes: minutes ?? undefined,
				// Empty clears the week on edit and leaves it unscheduled on create.
				week_id: value.week_id,
			};
			try {
				if (isEdit) {
					await updateQuiz.mutateAsync({ id: quiz.id, input });
					toastSuccess("Quiz updated", input.title);
				} else {
					await createQuiz.mutateAsync({ id: subjectId, input });
					toastSuccess("Quiz added", input.title);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(error, "Quiz could not be saved");
			}
		},
	});

	const pending = createQuiz.isPending || updateQuiz.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit quiz" : "Add quiz"}
			description="Quizzes belong to this subject. Questions are added from the quiz itself."
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
								form="quiz-form"
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
								{isEdit ? "Save quiz" : "Add quiz"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="quiz-form"
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
							value.trim() ? undefined : "Enter a quiz title.",
					}}
				>
					{(field) => (
						<TextField
							label="Quiz title"
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
							placeholder="Derivatives check"
							autoFocus
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field name="description">
					{(field) => (
						<TextField
							label="Description"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							placeholder="Short quiz on differentiation rules."
							hint="Optional."
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field
					name="time_limit_minutes"
					validators={{
						onChange: ({ value }) => {
							if (!value.trim()) return undefined;
							const minutes = parseInteger(value);
							if (minutes === null) return "Use a whole number of minutes.";
							return minutes > 0 ? undefined : "Use at least 1 minute.";
						},
					}}
				>
					{(field) => (
						<TextField
							label="Time limit"
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
							hint="Minutes. Optional."
							trailing={<span className="field__suffix">min</span>}
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
