import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { errorMessage, type SchoolYear } from "../../api";
import { firstError } from "../../form";
import { useSchoolYearMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, Switch, TextField } from "../ui";

/** Two calendar years, whichever separator was typed. */
const YEAR_PATTERN = /^\d{4}\s*[-/]\s*\d{4}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Create or edit one academic year. Renaming is safe: the subjects and grade
 * scales that name the year follow it on the server.
 */
export function SchoolYearFormDialog({
	schoolYear,
	canActivate,
	onClose,
}: {
	schoolYear?: SchoolYear;
	/** False when the dialog is opened on an already-current year. */
	canActivate: boolean;
	onClose: () => void;
}) {
	const { createSchoolYear, updateSchoolYear } = useSchoolYearMutations();
	const isEdit = schoolYear !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);
	const [makeActive, setMakeActive] = useState(
		canActivate && (schoolYear?.is_active ?? false),
	);

	const form = useForm({
		defaultValues: {
			name: schoolYear?.name ?? "",
			starts_on: schoolYear?.starts_on ?? "",
			ends_on: schoolYear?.ends_on ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const input = {
				name: value.name.trim(),
				starts_on: value.starts_on.trim() || undefined,
				ends_on: value.ends_on.trim() || undefined,
				is_active: makeActive || undefined,
			};
			try {
				if (isEdit) {
					await updateSchoolYear.mutateAsync({ id: schoolYear.id, input });
					toastSuccess("School year updated", input.name);
				} else {
					await createSchoolYear.mutateAsync(input);
					toastSuccess("School year created", input.name);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(
					error,
					isEdit
						? "School year could not be updated"
						: "School year could not be created",
				);
			}
		},
	});

	const pending = createSchoolYear.isPending || updateSchoolYear.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit school year" : "New school year"}
			description={
				isEdit
					? "Subjects and grade scales that name this year follow a rename, so nothing is left behind."
					: "One year covers two calendar years, for example 2026/2027. The first year created becomes the current one."
			}
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
							[state.canSubmit, state.isSubmitting, state.values.name] as const
						}
					>
						{([canSubmit, isSubmitting, name]) => (
							<Button
								type="submit"
								form="school-year-form"
								variant="primary"
								disabled={!canSubmit || !name.trim() || isSubmitting || pending}
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
								{isEdit ? "Save year" : "Create year"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="school-year-form"
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
							YEAR_PATTERN.test(value.trim())
								? undefined
								: "Use two calendar years, like 2026/2027.",
					}}
				>
					{(field) => (
						<TextField
							label="School year"
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
							placeholder="2026/2027"
							hint="Two calendar years, joined by a slash."
							autoFocus
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field
					name="starts_on"
					validators={{
						onChange: ({ value }) =>
							value.trim() === "" || DATE_PATTERN.test(value.trim())
								? undefined
								: "Use the form YYYY-MM-DD.",
					}}
				>
					{(field) => (
						<TextField
							label="Starts on"
							type="date"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							error={
								field.state.meta.isDirty
									? firstError(field.state.meta.errors)
									: undefined
							}
							hint="Optional. The first teaching day."
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field
					name="ends_on"
					validators={{
						onChangeListenTo: ["starts_on"],
						onChange: ({ value, fieldApi }) => {
							const trimmed = value.trim();
							if (trimmed !== "" && !DATE_PATTERN.test(trimmed)) {
								return "Use the form YYYY-MM-DD.";
							}
							const starts = (
								fieldApi.form.getFieldValue("starts_on") ?? ""
							).trim();
							if (trimmed !== "" && starts !== "" && trimmed < starts) {
								return "The year cannot end before it starts.";
							}
							return undefined;
						},
					}}
				>
					{(field) => (
						<TextField
							label="Ends on"
							type="date"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							error={
								field.state.meta.isDirty
									? firstError(field.state.meta.errors)
									: undefined
							}
							hint="Optional. The last exam day."
							disabled={pending}
						/>
					)}
				</form.Field>

				{canActivate ? (
					<div className="row row--between">
						<div>
							<p className="field__label">Make this the current year</p>
							<p className="field__description">
								New subjects are scheduled here, and the previous year stops
								being current.
							</p>
						</div>
						<Switch
							checked={makeActive}
							onChange={setMakeActive}
							label="Make this the current school year"
							disabled={pending}
						/>
					</div>
				) : null}
			</form>
		</Dialog>
	);
}
