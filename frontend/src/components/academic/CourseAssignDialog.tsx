import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { errorMessage, type Programme } from "../../api";
import { useAcademicMutations, useSubjects } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, SelectField } from "../ui";

/**
 * Files an existing course under this programme. The course keeps its own
 * content; what changes is which curriculum it belongs to and in which year of
 * study it is taught.
 */
export function CourseAssignDialog({
	programme,
	onClose,
}: {
	programme: Programme;
	onClose: () => void;
}) {
	const { assignCourse } = useAcademicMutations(programme.id);
	// The course catalog is paginated; this picks from the first page, which is
	// enough to file a course into place by hand.
	const subjects = useSubjects({ page: 1, page_size: 100 });
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: { subject_id: "", year_of_study: "1" },
		onSubmit: async ({ value }) => {
			if (!value.subject_id) {
				setServerError("Pick the course to add.");
				return;
			}
			setServerError(null);
			try {
				await assignCourse.mutateAsync({
					id: programme.id,
					input: {
						subject_id: value.subject_id,
						year_of_study: Number(value.year_of_study),
					},
				});
				toastSuccess("Course added to the programme", programme.name);
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(error, "The course could not be added");
			}
		},
	});

	const pending = assignCourse.isPending;
	const yearOptions = Array.from(
		{ length: programme.duration_years },
		(_, index) => ({
			value: String(index + 1),
			label: `Year ${index + 1}`,
		}),
	);

	const courseOptions = [
		{
			value: "",
			label: subjects.isLoading ? "Loading courses…" : "Pick a course",
		},
		...(subjects.data?.items ?? []).map((subject) => ({
			value: subject.id,
			label: subject.programme_name
				? `${subject.name} — currently in ${subject.programme_name}`
				: subject.code
					? `${subject.name} (${subject.code})`
					: subject.name,
		})),
	];

	return (
		<Dialog
			title="Add a course"
			description={`Courses listed on ${programme.name} are its curriculum. Moving a course from another programme takes it out of that one.`}
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
					<Button
						type="submit"
						form="course-assign-form"
						variant="primary"
						disabled={pending}
						icon={
							pending ? (
								<CircleNotch
									size={14}
									weight="bold"
									className="spinner"
									aria-hidden="true"
								/>
							) : null
						}
					>
						Add course
					</Button>
				</>
			}
		>
			<form
				id="course-assign-form"
				className="stack--sm"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field name="subject_id">
					{(field) => (
						<SelectField
							label="Course"
							value={field.state.value}
							onChange={(next) => {
								setServerError(null);
								field.handleChange(next);
							}}
							onBlur={() => field.handleBlur()}
							options={courseOptions}
							disabled={pending || subjects.isPending}
							hint="Every subject on the first page of the catalog is listed."
						/>
					)}
				</form.Field>

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
			</form>
		</Dialog>
	);
}
