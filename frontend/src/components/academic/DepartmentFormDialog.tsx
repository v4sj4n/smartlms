import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { type Department, errorMessage, type Faculty } from "../../api";
import { firstError } from "../../form";
import { useAcademicMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, SelectField, TextField } from "../ui";

/**
 * Create a department inside a faculty, or move an existing one to another
 * faculty. Departments are where programmes hang.
 */
export function DepartmentFormDialog({
	faculties,
	faculty,
	department,
	onClose,
}: {
	faculties: Faculty[];
	/** The faculty a new department starts in. */
	faculty?: Faculty;
	department?: Department;
	onClose: () => void;
}) {
	const { createDepartment, updateDepartment } = useAcademicMutations();
	const isEdit = department !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);

	const facultyOptions = faculties.map((item) => ({
		value: item.id,
		label: item.code ? `${item.name} (${item.code})` : item.name,
	}));

	const form = useForm({
		defaultValues: {
			faculty_id:
				department?.faculty_id ?? faculty?.id ?? faculties[0]?.id ?? "",
			name: department?.name ?? "",
			code: department?.code ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const input = {
				name: value.name.trim(),
				code: value.code.trim() || undefined,
			};
			try {
				if (isEdit) {
					await updateDepartment.mutateAsync({
						id: department.id,
						input: { ...input, faculty_id: value.faculty_id },
					});
					toastSuccess("Department updated", input.name);
				} else {
					await createDepartment.mutateAsync({
						...input,
						faculty_id: value.faculty_id,
					});
					toastSuccess("Department created", input.name);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(
					error,
					isEdit
						? "Department could not be updated"
						: "Department could not be created",
				);
			}
		},
	});

	const pending = createDepartment.isPending || updateDepartment.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit department" : "Add department"}
			description="Departments run the programmes: a degree belongs to exactly one department."
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
								form="department-form"
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
								{isEdit ? "Save department" : "Create department"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="department-form"
				className="stack--sm"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field name="faculty_id">
					{(field) => (
						<SelectField
							label="Faculty"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							options={facultyOptions}
							disabled={pending || facultyOptions.length === 0}
							hint={
								facultyOptions.length === 0
									? "Add a faculty first; a department always belongs to one."
									: undefined
							}
						/>
					)}
				</form.Field>

				<form.Field
					name="name"
					validators={{
						onChange: ({ value }) =>
							value.trim() ? undefined : "Enter a department name.",
					}}
				>
					{(field) => (
						<TextField
							label="Department name"
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
							placeholder="Department of Computer Science"
							autoFocus
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field name="code">
					{(field) => (
						<TextField
							label="Short code"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							placeholder="CS"
							hint="Optional."
							disabled={pending}
						/>
					)}
				</form.Field>
			</form>
		</Dialog>
	);
}
