import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { errorMessage, type SessionItem, type SessionKind } from "../../api";
import { firstError } from "../../form";
import { fromDateTimeLocal, toDateTimeLocal } from "../../format";
import { useCampuses, useSubjectMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, SelectField, TextField } from "../ui";
import { WeekField } from "./WeekField";

const NOUN: Record<SessionKind, string> = {
	lectures: "Lecture",
};

/** Add or edit a lecture or seminar: title, description, room and schedule. */
export function SessionFormDialog({
	kind,
	subjectId,
	item,
	onClose,
}: {
	kind: SessionKind;
	subjectId: string;
	item?: SessionItem;
	onClose: () => void;
}) {
	const { createSession, updateSession } = useSubjectMutations(subjectId);
	const campuses = useCampuses();
	const noun = NOUN[kind];
	const isEdit = item !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);

	const roomOptions = [
		{ value: "", label: "No room" },
		...(campuses.data ?? []).flatMap((campus) =>
			[...campus.stories]
				.sort((left, right) => left.floor - right.floor)
				.flatMap((story) =>
					story.classes.map((room) => ({
						value: room.id,
						label: `${campus.name} · Floor ${story.floor} · ${room.name}`,
					})),
				),
		),
	];

	const form = useForm({
		defaultValues: {
			title: item?.title ?? "",
			description: item?.description ?? "",
			class_id: item?.class_id ?? "",
			scheduled_at: toDateTimeLocal(item?.scheduled_at),
			week_id: item?.week_id ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const input = {
				title: value.title.trim(),
				description: value.description.trim() || undefined,
				class_id: value.class_id || undefined,
				scheduled_at: fromDateTimeLocal(value.scheduled_at) || undefined,
				// Empty clears the week on edit and leaves it unscheduled on create.
				week_id: value.week_id,
			};
			try {
				if (isEdit) {
					await updateSession.mutateAsync({ kind, id: item.id, input });
					toastSuccess(`${noun} updated`, input.title);
				} else {
					await createSession.mutateAsync({ kind, subjectId, input });
					toastSuccess(`${noun} added`, input.title);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(error, `${noun} could not be saved`);
			}
		},
	});

	const pending = createSession.isPending || updateSession.isPending;

	return (
		<Dialog
			title={
				isEdit ? `Edit ${noun.toLowerCase()}` : `Add ${noun.toLowerCase()}`
			}
			description="Lectures and seminars are scheduled into a room from the campus tree."
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
								form={`session-form-${kind}`}
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
								{isEdit
									? `Save ${noun.toLowerCase()}`
									: `Add ${noun.toLowerCase()}`}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id={`session-form-${kind}`}
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
							value.trim() ? undefined : `Enter a ${noun.toLowerCase()} title.`,
					}}
				>
					{(field) => (
						<TextField
							label={`${noun} title`}
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
							placeholder="Limits and continuity"
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
							placeholder="What the session covers."
							hint="Optional."
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field name="class_id">
					{(field) => (
						<SelectField
							label="Room"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							options={roomOptions}
							hint={
								campuses.isError
									? "Rooms could not be loaded; the room is left unchanged."
									: "Optional. Rooms come from the campus tree."
							}
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field
					name="scheduled_at"
					validators={{
						onChange: ({ value }) => {
							if (!value) return undefined;
							return Number.isNaN(new Date(value).getTime())
								? "Enter a valid date and time."
								: undefined;
						},
					}}
				>
					{(field) => (
						<TextField
							label="Scheduled for"
							type="datetime-local"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							error={
								field.state.meta.isDirty
									? firstError(field.state.meta.errors)
									: undefined
							}
							hint="Optional. Local time."
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
