import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import {
	type AdmissionStatus,
	errorMessage,
	type Programme,
	type ProgrammeStudent,
} from "../../api";
import { firstError } from "../../form";
import { useAcademicMutations, useSchoolYears, useUsers } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, SelectField } from "../ui";

const STATUS_OPTIONS: { value: AdmissionStatus; label: string }[] = [
	{ value: "ACTIVE", label: "Active — studies here now" },
	{ value: "SUSPENDED", label: "Suspended" },
	{ value: "GRADUATED", label: "Graduated" },
	{ value: "WITHDRAWN", label: "Withdrawn" },
];

/** "1st year", "2nd year", "3rd year", "nth year". */
function yearLabel(year: number): string {
	const suffix =
		year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th";
	return `${year}${suffix} year`;
}

/**
 * Admits a student to a programme, or edits an existing admission: the year of
 * study, the academic year it started in, and where it stands.
 */
export function AdmissionFormDialog({
	programme,
	admission,
	onClose,
}: {
	programme: Programme;
	admission?: ProgrammeStudent;
	onClose: () => void;
}) {
	const { admitStudent, updateAdmission } = useAcademicMutations(programme.id);
	const schoolYears = useSchoolYears();
	// The programme runs for a known number of years, so the picker can only
	// offer years that exist.
	const students = useUsers({ page: 1, page_size: 100, role: "STUDENT" });
	const isEdit = admission !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);

	const yearOptions = Array.from(
		{ length: programme.duration_years },
		(_, index) => ({
			value: String(index + 1),
			label: yearLabel(index + 1),
		}),
	);

	const schoolYearOptions = [
		{
			value: "",
			label: schoolYears.data?.active
				? `Current — ${schoolYears.data.active}`
				: "No year",
		},
		...(schoolYears.data?.items ?? []).map((year) => ({
			value: year.name,
			label: year.is_active ? `${year.name} · current` : year.name,
		})),
	];

	const studentOptions = [
		{ value: "", label: "Pick a student" },
		...(students.data?.items ?? []).map((student) => ({
			value: student.id,
			label: `${student.name} — ${student.email}`,
		})),
	];

	const form = useForm({
		defaultValues: {
			student_id: admission?.student_id ?? "",
			year_of_study: String(admission?.year_of_study ?? 1),
			school_year: admission?.school_year ?? "",
			status: (admission?.status ?? "ACTIVE") as AdmissionStatus,
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			try {
				if (isEdit) {
					await updateAdmission.mutateAsync({
						id: admission.enrollment_id,
						input: {
							year_of_study: Number(value.year_of_study),
							school_year: value.school_year,
							status: value.status,
						},
					});
					toastSuccess("Admission updated", admission.name);
				} else {
					await admitStudent.mutateAsync({
						id: programme.id,
						input: {
							student_id: value.student_id,
							year_of_study: Number(value.year_of_study),
							school_year: value.school_year || undefined,
						},
					});
					toastSuccess("Student admitted", programme.name);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(
					error,
					isEdit
						? "The admission could not be updated"
						: "The student could not be admitted",
				);
			}
		},
	});

	const pending = admitStudent.isPending || updateAdmission.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit admission" : "Admit a student"}
			description={
				isEdit
					? `${admission.name} · ${programme.name}`
					: `Add a student to ${programme.name}. A student follows one programme at a time.`
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
							[
								state.canSubmit,
								state.isSubmitting,
								state.values.student_id,
							] as const
						}
					>
						{([canSubmit, isSubmitting, studentId]) => (
							<Button
								type="submit"
								form="admission-form"
								variant="primary"
								disabled={
									!canSubmit ||
									(!isEdit && !studentId) ||
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
								{isEdit ? "Save admission" : "Admit student"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="admission-form"
				className="stack--sm"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				{isEdit ? null : (
					<form.Field
						name="student_id"
						validators={{
							onChange: ({ value }) =>
								value ? undefined : "Pick the student to admit.",
						}}
					>
						{(field) => (
							<SelectField
								label="Student"
								value={field.state.value}
								onChange={(next) => {
									setServerError(null);
									field.handleChange(next);
								}}
								onBlur={() => field.handleBlur()}
								options={studentOptions}
								disabled={pending || students.isPending}
								error={
									field.state.meta.isTouched
										? firstError(field.state.meta.errors)
										: undefined
								}
								hint={
									students.isLoading
										? "Loading students…"
										: "Only accounts with the student role can be admitted."
								}
							/>
						)}
					</form.Field>
				)}

				<div className="grid grid--2">
					<form.Field name="year_of_study">
						{(field) => (
							<SelectField
								label="Year of study"
								value={field.state.value}
								onChange={(next) => field.handleChange(next)}
								options={yearOptions}
								disabled={pending}
								hint={`This programme runs for ${programme.duration_years} years.`}
							/>
						)}
					</form.Field>

					<form.Field name="school_year">
						{(field) => (
							<SelectField
								label="Admitted in"
								value={field.state.value}
								onChange={(next) => field.handleChange(next)}
								options={schoolYearOptions}
								disabled={pending}
								hint="Empty means the current school year."
							/>
						)}
					</form.Field>
				</div>

				{isEdit ? (
					<form.Field name="status">
						{(field) => (
							<SelectField
								label="Status"
								value={field.state.value}
								onChange={(next) => field.handleChange(next as AdmissionStatus)}
								options={STATUS_OPTIONS}
								disabled={pending}
								hint="Ending an admission frees the student for another programme."
							/>
						)}
					</form.Field>
				) : null}
			</form>
		</Dialog>
	);
}
