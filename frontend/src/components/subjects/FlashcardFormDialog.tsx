import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { errorMessage, type Flashcard } from "../../api";
import { firstError } from "../../form";
import { useSubjectMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, TextField } from "../ui";
import { WeekField } from "./WeekField";

/** Add or edit a flashcard: front and back are both required. */
export function FlashcardFormDialog({
	subjectId,
	card,
	onClose,
}: {
	subjectId: string;
	card?: Flashcard;
	onClose: () => void;
}) {
	const { createFlashcard, updateFlashcard } = useSubjectMutations(subjectId);
	const isEdit = card !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			front: card?.front ?? "",
			back: card?.back ?? "",
			week_id: card?.week_id ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const input = {
				front: value.front.trim(),
				back: value.back.trim(),
				// Empty clears the week on edit and leaves it unscheduled on create.
				week_id: value.week_id,
			};
			try {
				if (isEdit) {
					await updateFlashcard.mutateAsync({ id: card.id, input });
					toastSuccess("Flashcard updated");
				} else {
					await createFlashcard.mutateAsync({ id: subjectId, input });
					toastSuccess("Flashcard added");
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(error, "Flashcard could not be saved");
			}
		},
	});

	const pending = createFlashcard.isPending || updateFlashcard.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit flashcard" : "Add flashcard"}
			description="A prompt on the front, the answer on the back."
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
							[
								state.canSubmit,
								state.isSubmitting,
								state.values.front,
								state.values.back,
							] as const
						}
					>
						{([canSubmit, isSubmitting, front, back]) => (
							<Button
								type="submit"
								form="flashcard-form"
								variant="primary"
								disabled={
									!canSubmit ||
									!front.trim() ||
									!back.trim() ||
									isSubmitting ||
									pending
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
								{isEdit ? "Save flashcard" : "Add flashcard"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="flashcard-form"
				className="stack--sm"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field
					name="front"
					validators={{
						onChange: ({ value }) =>
							value.trim() ? undefined : "Enter the front of the card.",
					}}
				>
					{(field) => (
						<TextField
							label="Front"
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
							placeholder="What is the derivative of sin x?"
							autoFocus
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field
					name="back"
					validators={{
						onChange: ({ value }) =>
							value.trim() ? undefined : "Enter the back of the card.",
					}}
				>
					{(field) => (
						<TextField
							label="Back"
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
							placeholder="cos x"
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
