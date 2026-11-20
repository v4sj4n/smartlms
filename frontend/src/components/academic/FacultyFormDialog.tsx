import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { errorMessage, type Faculty } from "../../api";
import { firstError } from "../../form";
import { useAcademicMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, TextField } from "../ui";

/** Create or rename a faculty, the top of the academic structure. */
export function FacultyFormDialog({
	faculty,
	onClose,
}: {
	faculty?: Faculty;
	onClose: () => void;
}) {
	const { createFaculty, updateFaculty } = useAcademicMutations();
	const isEdit = faculty !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			name: faculty?.name ?? "",
			code: faculty?.code ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const input = {
				name: value.name.trim(),
				code: value.code.trim() || undefined,
			};
			try {
				if (isEdit) {
					await updateFaculty.mutateAsync({ id: faculty.id, input });
					toastSuccess("Faculty updated", input.name);
				} else {
					await createFaculty.mutateAsync(input);
					toastSuccess("Faculty created", input.name);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(
					error,
					isEdit
						? "Faculty could not be updated"
						: "Faculty could not be created",
				);
			}
		},
	});

	const pending = createFaculty.isPending || updateFaculty.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit faculty" : "Add faculty"}
			description={
				isEdit
					? "Rename the faculty or correct its code."
					: "A faculty holds departments, and departments hold the programmes students join."
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
								form="faculty-form"
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
								{isEdit ? "Save faculty" : "Create faculty"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="faculty-form"
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
							value.trim() ? undefined : "Enter a faculty name.",
					}}
				>
					{(field) => (
						<TextField
							label="Faculty name"
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
							placeholder="Faculty of Natural Sciences"
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
							placeholder="FNS"
							hint="Optional. Used where space is tight."
							disabled={pending}
						/>
					)}
				</form.Field>
			</form>
		</Dialog>
	);
}
