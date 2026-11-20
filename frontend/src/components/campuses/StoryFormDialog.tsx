import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { ApiError, type Campus, errorMessage, type Story } from "../../api";
import { firstError, parseInteger } from "../../form";
import { useCampusMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, TextField } from "../ui";

export function StoryFormDialog({
	campus,
	story,
	onClose,
}: {
	campus: Campus;
	story?: Story;
	onClose: () => void;
}) {
	const { createStory, updateStory } = useCampusMutations();
	const isEdit = story !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);
	const [floorError, setFloorError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			floor: story ? String(story.floor) : "",
			name: story?.name ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			setFloorError(null);
			const floor = parseInteger(value.floor);
			if (floor === null) return;
			const input = { floor, name: value.name.trim() || undefined };
			try {
				if (isEdit) {
					await updateStory.mutateAsync({ id: story.id, input });
					toastSuccess("Story updated", `Floor ${floor}`);
				} else {
					await createStory.mutateAsync({ campusId: campus.id, input });
					toastSuccess("Story added", `Floor ${floor} in ${campus.name}`);
				}
				onClose();
			} catch (error) {
				const message = errorMessage(error);
				if (error instanceof ApiError && error.status === 409) {
					// The API's duplicate-floor conflict belongs on the floor field.
					setFloorError(`Floor ${floor} already exists on this campus.`);
					toastApiError(error);
					return;
				}
				setServerError(message);
				toastApiError(
					error,
					isEdit ? "Story could not be updated" : "Story could not be added",
				);
			}
		},
	});

	const pending = createStory.isPending || updateStory.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit story" : "Add story"}
			description={`${campus.name} — a story is one floor of the campus.`}
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
							[state.canSubmit, state.isSubmitting, state.values.floor] as const
						}
					>
						{([canSubmit, isSubmitting, floor]) => (
							<Button
								type="submit"
								form="story-form"
								variant="primary"
								disabled={
									!canSubmit ||
									parseInteger(floor) === null ||
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
								{isEdit ? "Save story" : "Add story"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="story-form"
				className="stack--sm"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field
					name="floor"
					validators={{
						onChange: ({ value }) =>
							parseInteger(value) === null
								? "Enter a whole floor number."
								: undefined,
					}}
				>
					{(field) => (
						<TextField
							label="Floor"
							type="number"
							inputMode="numeric"
							value={field.state.value}
							onChange={(next) => {
								setFloorError(null);
								setServerError(null);
								field.handleChange(next);
							}}
							onBlur={() => field.handleBlur()}
							error={
								floorError ??
								(field.state.meta.isDirty
									? firstError(field.state.meta.errors)
									: undefined)
							}
							placeholder="1"
							autoFocus
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field name="name">
					{(field) => (
						<TextField
							label="Story name"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							placeholder="Ground floor"
							disabled={pending}
							hint="Optional, e.g. “Science wing”."
						/>
					)}
				</form.Field>
			</form>
		</Dialog>
	);
}
