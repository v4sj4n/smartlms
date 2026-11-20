import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import {
	type CourseWeek,
	errorMessage,
	type WeekInput,
	type WeekSeason,
} from "../../api";
import { firstError, parseInteger } from "../../form";
import { useWeekMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, SelectField, TextArea, TextField } from "../ui";

const SEASON_OPTIONS: { value: WeekSeason; label: string }[] = [
	{ value: "FALL", label: "Fall semester" },
	{ value: "SUMMER", label: "Summer semester" },
];

/**
 * Add or edit a week of the term. A week is seven days: giving the start is
 * enough, the API fills in the Sunday. The number defaults to the next free one
 * in the season.
 */
export function WeekFormDialog({
	subjectId,
	season,
	week,
	nextNumber,
	onClose,
}: {
	subjectId: string;
	/** The season the subject runs in, used for a new week. */
	season: WeekSeason;
	week?: CourseWeek;
	/** Suggested number for a new week in that season. */
	nextNumber: number;
	onClose: () => void;
}) {
	const { create, update } = useWeekMutations(subjectId);
	const isEdit = week !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			season: (week?.season ?? season) as WeekSeason,
			week_number: String(week?.week_number ?? nextNumber),
			title: week?.title ?? "",
			description: week?.description ?? "",
			starts_on: week?.starts_on ?? "",
			ends_on: week?.ends_on ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const number = parseInteger(value.week_number);
			const input: WeekInput = {
				season: value.season,
				week_number: number ?? undefined,
				title: value.title.trim() || undefined,
				description: value.description.trim() || undefined,
				starts_on: value.starts_on || undefined,
				ends_on: value.ends_on || undefined,
			};
			try {
				if (isEdit) {
					await update.mutateAsync({
						id: week.id,
						input: {
							...input,
							// The API treats an empty title as "clear it".
							title: value.title.trim(),
							description: value.description.trim(),
							starts_on: value.starts_on,
							ends_on: value.ends_on,
						},
					});
					toastSuccess("Week updated", `Week ${number ?? week.week_number}`);
				} else {
					await create.mutateAsync(input);
					toastSuccess("Week added", `Week ${number ?? nextNumber}`);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(
					error,
					isEdit
						? "The week could not be updated"
						: "The week could not be added",
				);
			}
		},
	});

	const pending = create.isPending || update.isPending;

	return (
		<Dialog
			title={isEdit ? `Edit week ${week.week_number}` : "Add a week"}
			description="A week is seven days of the term. The content filed into it shows up on the Weeks tab."
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
						selector={(state) => [state.canSubmit, state.isSubmitting] as const}
					>
						{([canSubmit, isSubmitting]) => (
							<Button
								type="submit"
								form="week-form"
								variant="primary"
								disabled={!canSubmit || isSubmitting || pending}
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
								{isEdit ? "Save week" : "Add week"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="week-form"
				className="stack--sm"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<div className="grid grid--2">
					<form.Field name="season">
						{(field) => (
							<SelectField
								label="Season"
								value={field.state.value}
								onChange={(next) => field.handleChange(next as WeekSeason)}
								options={SEASON_OPTIONS}
								hint="The academic year runs fall, then summer."
								disabled={pending}
							/>
						)}
					</form.Field>

					<form.Field
						name="week_number"
						validators={{
							onChange: ({ value }) => {
								const number = parseInteger(value);
								if (number === null || number < 1 || number > 30) {
									return "A week number runs from 1 to 30.";
								}
								return undefined;
							},
						}}
					>
						{(field) => (
							<TextField
								label="Week number"
								type="number"
								min={1}
								value={field.state.value}
								onChange={(next) => field.handleChange(next)}
								onBlur={() => field.handleBlur()}
								error={
									field.state.meta.isDirty
										? firstError(field.state.meta.errors)
										: undefined
								}
								hint="Weeks read 1, 2, 3 … inside the season."
								disabled={pending}
							/>
						)}
					</form.Field>
				</div>

				<div className="grid grid--2">
					<form.Field name="starts_on">
						{(field) => (
							<TextField
								label="Starts on"
								type="date"
								value={field.state.value}
								onChange={(next) => field.handleChange(next)}
								onBlur={() => field.handleBlur()}
								hint="Monday, usually. Leave both empty to plan without dates."
								disabled={pending}
							/>
						)}
					</form.Field>

					<form.Field name="ends_on">
						{(field) => (
							<TextField
								label="Ends on"
								type="date"
								value={field.state.value}
								onChange={(next) => field.handleChange(next)}
								onBlur={() => field.handleBlur()}
								hint="Empty means the Sunday of the same week."
								disabled={pending}
							/>
						)}
					</form.Field>
				</div>

				<form.Field name="title">
					{(field) => (
						<TextField
							label="Title"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							placeholder="Limits and continuity"
							hint="Optional. The date range is what the week is usually called."
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field name="description">
					{(field) => (
						<TextArea
							label="Description"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							rows={2}
							placeholder="What this week covers."
							hint="Optional."
							disabled={pending}
						/>
					)}
				</form.Field>
			</form>
		</Dialog>
	);
}
