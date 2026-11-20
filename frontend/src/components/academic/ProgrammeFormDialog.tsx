import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import {
	errorMessage,
	type ProgrammeInput,
	type ProgrammeLevel,
	type ProgrammeRow,
} from "../../api";
import { firstError } from "../../form";
import { useAcademicMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, SelectField, TextArea, TextField } from "../ui";

export type DepartmentOption = {
	id: string;
	name: string;
	facultyName: string;
};

const LEVEL_OPTIONS: { value: ProgrammeLevel; label: string }[] = [
	{ value: "BACHELOR", label: "Bachelor's degree" },
	{ value: "MASTER", label: "Master's degree" },
	{ value: "DOCTORATE", label: "Doctorate" },
];

/** Create or edit a programme (dega): the degree a student is admitted to. */
export function ProgrammeFormDialog({
	departments,
	defaultDepartmentId,
	programme,
	onClose,
}: {
	departments: DepartmentOption[];
	defaultDepartmentId?: string;
	programme?: ProgrammeRow & { description?: string };
	onClose: () => void;
}) {
	const { createProgramme, updateProgramme } = useAcademicMutations(
		programme?.id,
	);
	const isEdit = programme !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);

	const departmentOptions = departments.map((item) => ({
		value: item.id,
		label: `${item.name} — ${item.facultyName}`,
	}));

	const form = useForm({
		defaultValues: {
			department_id:
				programme?.department_id ??
				defaultDepartmentId ??
				departments[0]?.id ??
				"",
			name: programme?.name ?? "",
			code: programme?.code ?? "",
			level: (programme?.level ?? "BACHELOR") as ProgrammeLevel,
			duration_years: String(programme?.duration_years ?? 3),
			total_ects: programme?.total_ects ? String(programme.total_ects) : "",
			description: programme?.description ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const input: ProgrammeInput = {
				department_id: value.department_id,
				name: value.name.trim(),
				code: value.code.trim() || undefined,
				level: value.level,
				duration_years: Number(value.duration_years) || undefined,
				total_ects: Number(value.total_ects) || undefined,
				description: value.description.trim() || undefined,
			};
			try {
				if (isEdit) {
					await updateProgramme.mutateAsync({ id: programme.id, input });
					toastSuccess("Programme updated", input.name);
				} else {
					await createProgramme.mutateAsync(input);
					toastSuccess("Programme created", input.name);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(
					error,
					isEdit
						? "Programme could not be updated"
						: "Programme could not be created",
				);
			}
		},
	});

	const pending = createProgramme.isPending || updateProgramme.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit programme" : "Add programme"}
			description="A programme owns its curriculum and its students: the courses listed under it are the ones it teaches."
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
								form="programme-form"
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
								{isEdit ? "Save programme" : "Create programme"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="programme-form"
				className="stack--sm"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field name="department_id">
					{(field) => (
						<SelectField
							label="Department"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							options={departmentOptions}
							disabled={pending || departmentOptions.length === 0}
							hint={
								departmentOptions.length === 0
									? "Add a department first; every programme belongs to one."
									: undefined
							}
						/>
					)}
				</form.Field>

				<form.Field
					name="name"
					validators={{
						onChange: ({ value }) =>
							value.trim() ? undefined : "Enter a programme name.",
					}}
				>
					{(field) => (
						<TextField
							label="Programme name"
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
							placeholder="Computer Science"
							autoFocus
							disabled={pending}
						/>
					)}
				</form.Field>

				<div className="grid grid--2">
					<form.Field name="code">
						{(field) => (
							<TextField
								label="Short code"
								value={field.state.value}
								onChange={(next) => field.handleChange(next)}
								onBlur={() => field.handleBlur()}
								placeholder="BSc-CS"
								hint="Optional, must be unique."
								disabled={pending}
							/>
						)}
					</form.Field>

					<form.Field name="level">
						{(field) => (
							<SelectField
								label="Level"
								value={field.state.value}
								onChange={(next) => field.handleChange(next as ProgrammeLevel)}
								options={LEVEL_OPTIONS}
								hint="Bachelor's, master's or doctorate."
								disabled={pending}
							/>
						)}
					</form.Field>
				</div>

				<div className="grid grid--2">
					<form.Field
						name="duration_years"
						validators={{
							onChange: ({ value }) => {
								const years = Number(value);
								if (!Number.isInteger(years) || years < 1 || years > 8) {
									return "Between 1 and 8 years.";
								}
								return undefined;
							},
						}}
					>
						{(field) => (
							<TextField
								label="Duration (years)"
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
								hint="How many years of study the degree lasts."
								disabled={pending}
							/>
						)}
					</form.Field>

					<form.Field name="total_ects">
						{(field) => (
							<TextField
								label="Total ECTS"
								type="number"
								min={0}
								value={field.state.value}
								onChange={(next) => field.handleChange(next)}
								onBlur={() => field.handleBlur()}
								placeholder="180"
								hint="Optional."
								disabled={pending}
							/>
						)}
					</form.Field>
				</div>

				<form.Field name="description">
					{(field) => (
						<TextArea
							label="Description"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							rows={3}
							placeholder="What the programme covers."
							hint="Optional."
							disabled={pending}
						/>
					)}
				</form.Field>
			</form>
		</Dialog>
	);
}
