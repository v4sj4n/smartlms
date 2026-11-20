import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { type ClassRoom, errorMessage, type Story } from "../../api";
import { firstError, parseInteger, parseTags } from "../../form";
import { useCampusMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Chip, Dialog, TextField } from "../ui";

export function ClassFormDialog({
	story,
	room,
	onClose,
}: {
	story: Story;
	room?: ClassRoom;
	onClose: () => void;
}) {
	const { createClass, updateClass } = useCampusMutations();
	const isEdit = room !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			name: room?.name ?? "",
			capacity: room ? String(room.capacity) : "",
			tags: room ? room.tags.join(", ") : "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const capacity = parseInteger(value.capacity);
			if (capacity === null || capacity < 1) return;
			const input = {
				name: value.name.trim(),
				capacity,
				tags: parseTags(value.tags),
			};
			try {
				if (isEdit) {
					await updateClass.mutateAsync({ id: room.id, input });
					toastSuccess("Room updated", input.name);
				} else {
					await createClass.mutateAsync({ storyId: story.id, input });
					toastSuccess("Room added", `${input.name} · floor ${story.floor}`);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(
					error,
					isEdit ? "Room could not be updated" : "Room could not be added",
				);
			}
		},
	});

	const pending = createClass.isPending || updateClass.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit room" : "Add room"}
			description={`Floor ${story.floor}${story.name ? ` · ${story.name}` : ""}`}
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
								state.values.name,
								state.values.capacity,
							] as const
						}
					>
						{([canSubmit, isSubmitting, name, capacity]) => {
							const parsed = parseInteger(capacity);
							return (
								<Button
									type="submit"
									form="class-form"
									variant="primary"
									disabled={
										!canSubmit ||
										!name.trim() ||
										parsed === null ||
										parsed < 1 ||
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
									{isEdit ? "Save room" : "Add room"}
								</Button>
							);
						}}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="class-form"
				className="stack--sm"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field
					name="name"
					validators={{
						onChange: ({ value }) =>
							value.trim() ? undefined : "Enter a room name.",
					}}
				>
					{(field) => (
						<TextField
							label="Room name"
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
							placeholder="Room 101"
							autoFocus
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field
					name="capacity"
					validators={{
						onChange: ({ value }) => {
							const parsed = parseInteger(value);
							if (parsed === null) return "Enter a capacity.";
							if (parsed < 1) return "Capacity must be at least 1.";
							return undefined;
						},
					}}
				>
					{(field) => (
						<TextField
							label="Capacity"
							type="number"
							inputMode="numeric"
							min={1}
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							error={
								field.state.meta.isDirty
									? firstError(field.state.meta.errors)
									: undefined
							}
							placeholder="24"
							disabled={pending}
							hint="Seats in this room."
						/>
					)}
				</form.Field>

				<form.Field name="tags">
					{(field) => {
						const tags = parseTags(field.state.value);
						return (
							<>
								<TextField
									label="Tags"
									value={field.state.value}
									onChange={(next) => field.handleChange(next)}
									onBlur={() => field.handleBlur()}
									placeholder="computers, lab"
									disabled={pending}
									hint="Comma-separated. Duplicates and stray spaces are removed."
								/>
								{tags.length > 0 ? (
									<div className="row">
										{tags.map((tag) => (
											<Chip key={tag} tone="muted">
												{tag}
											</Chip>
										))}
									</div>
								) : null}
							</>
						);
					}}
				</form.Field>
			</form>
		</Dialog>
	);
}
