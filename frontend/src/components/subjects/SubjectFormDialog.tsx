import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { errorMessage, type Subject } from "../../api";
import { firstError } from "../../form";
import {
	useAcademicTree,
	useSchoolYears,
	useSubjectMutations,
	useUsers,
} from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, SelectField, TextField } from "../ui";

/**
 * Create or edit a subject: its name, code, lecturer, and the academic year it
 * is taught in. An empty year means "the current one", which is what the API
 * does when a subject is created without a year.
 */
export function SubjectFormDialog({
	subject,
	onClose,
}: {
	subject?: Subject;
	onClose: () => void;
}) {
	const { createSubject, updateSubject } = useSubjectMutations();
	// Lecturers come from the paginated users endpoint, which carries ids.
	const lecturers = useUsers({ page: 1, page_size: 100, role: "LECTURER" });
	const schoolYears = useSchoolYears();
	// A subject is offered by a programme; the list comes from the academic tree.
	const academic = useAcademicTree();
	const programmes = (academic.data?.faculties ?? []).flatMap((faculty) =>
		faculty.departments.flatMap((department) =>
			department.programmes.map((programme) => ({
				...programme,
				path: `${faculty.name} · ${department.name}`,
			})),
		),
	);
	const isEdit = subject !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);
	const [programmeId, setProgrammeId] = useState(subject?.programme_id ?? "");
	const currentYear = schoolYears.data?.active;
	const chosenProgramme = programmes.find(
		(programme) => programme.id === programmeId,
	);

	const programmeOptions = [
		{ value: "", label: "No programme" },
		...programmes.map((programme) => ({
			value: programme.id,
			label: `${programme.name} — ${programme.path}`,
		})),
	];

	const studyYearOptions = Array.from(
		{ length: chosenProgramme?.duration_years ?? 0 },
		(_, index) => ({ value: String(index + 1), label: `Year ${index + 1}` }),
	);

	const yearOptions = [
		{
			value: "",
			label: isEdit
				? "No year"
				: currentYear
					? `Current year — ${currentYear}`
					: "No year",
		},
		...(schoolYears.data?.items ?? []).map((year) => ({
			value: year.name,
			label: year.is_active ? `${year.name} · current` : year.name,
		})),
	];

	const lecturerOptions = [
		{ value: "", label: "Unassigned" },
		...(lecturers.data?.items ?? []).map((user) => ({
			value: user.id,
			label: user.name,
		})),
	];

	const form = useForm({
		defaultValues: {
			name: subject?.name ?? "",
			code: subject?.code ?? "",
			description: subject?.description ?? "",
			lecturer_id: subject?.lecturer_id ?? "",
			semester: subject?.semester ?? "FIRST",
			school_year: subject?.school_year ?? "",
			programme_id: subject?.programme_id ?? "",
			year_of_study: String(subject?.year_of_study ?? 1),
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const input = {
				name: value.name.trim(),
				code: value.code.trim() || undefined,
				description: value.description.trim() || undefined,
				lecturer_id: value.lecturer_id || undefined,
				semester: value.semester,
				// On create an empty year inherits the current one; on edit it clears it.
				school_year: isEdit
					? value.school_year
					: value.school_year || undefined,
				// Empty clears the programme on edit and leaves it unassigned on create.
				programme_id: isEdit
					? value.programme_id
					: value.programme_id || undefined,
				year_of_study: value.programme_id
					? Number(value.year_of_study)
					: undefined,
			};
			try {
				if (isEdit) {
					await updateSubject.mutateAsync({ id: subject.id, input });
					toastSuccess("Subject updated", input.name);
				} else {
					await createSubject.mutateAsync(input);
					toastSuccess("Subject created", input.name);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(
					error,
					isEdit
						? "Subject could not be updated"
						: "Subject could not be created",
				);
			}
		},
	});

	const pending = createSubject.isPending || updateSubject.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit subject" : "New subject"}
			description={
				isEdit
					? "Rename the subject, change its code, reassign the lecturer or move it to another school year."
					: "Subjects hold their own lectures, seminars, quizzes and flashcards."
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
								form="subject-form"
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
								{isEdit ? "Save subject" : "Create subject"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="subject-form"
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
							value.trim() ? undefined : "Enter a subject name.",
					}}
				>
					{(field) => (
						<TextField
							label="Subject name"
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
							placeholder="Calculus I"
							autoFocus
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field name="code">
					{(field) => (
						<TextField
							label="Subject code"
							value={field.state.value}
							onChange={(next) => {
								setServerError(null);
								field.handleChange(next);
							}}
							onBlur={() => field.handleBlur()}
							placeholder="CALC101"
							hint="Optional, but must be unique."
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
							placeholder="First-semester calculus subject."
							hint="Optional."
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field name="semester">
					{(field) => (
						<SelectField
							label="Semester"
							value={field.state.value}
							onChange={(next) =>
								field.handleChange(next as "FIRST" | "SECOND")
							}
							onBlur={() => field.handleBlur()}
							options={[
								{ value: "FIRST", label: "Semester I" },
								{ value: "SECOND", label: "Semester II" },
							]}
							hint="Which half of the school year the subject runs in."
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field name="school_year">
					{(field) => (
						<SelectField
							label="School year"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							options={yearOptions}
							hint={
								schoolYears.isPending
									? "Loading the academic calendar…"
									: schoolYears.isError
										? "The calendar could not be loaded, so the year is left as it is."
										: "Subjects are filed under the year they are taught in."
							}
							// Without the catalog the select holds a single option, and saving
							// would quietly clear the subject's year: leave it alone instead.
							disabled={pending || !schoolYears.data}
						/>
					)}
				</form.Field>

				<form.Field name="programme_id">
					{(field) => (
						<SelectField
							label="Programme"
							value={field.state.value}
							onChange={(next) => {
								setServerError(null);
								setProgrammeId(next);
								field.handleChange(next);
							}}
							onBlur={() => field.handleBlur()}
							options={programmeOptions}
							hint={
								academic.isPending
									? "Loading the academic structure…"
									: "The programme that offers this subject. Its students sit in this course."
							}
							disabled={pending || !academic.data}
						/>
					)}
				</form.Field>

				{chosenProgramme ? (
					<form.Field name="year_of_study">
						{(field) => (
							<SelectField
								label="Year of study"
								value={field.state.value}
								onChange={(next) => field.handleChange(next)}
								onBlur={() => field.handleBlur()}
								options={studyYearOptions}
								hint={`${chosenProgramme.name} runs for ${chosenProgramme.duration_years} years.`}
								disabled={pending}
							/>
						)}
					</form.Field>
				) : null}

				<form.Field name="lecturer_id">
					{(field) => (
						<SelectField
							label="Lecturer"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							options={lecturerOptions}
							hint={
								lecturers.isPending
									? "Loading lecturers…"
									: "Optional. Only accounts with the LECTURER role are listed."
							}
							disabled={pending}
						/>
					)}
				</form.Field>
			</form>
		</Dialog>
	);
}
