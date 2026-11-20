import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { type Campus, errorMessage } from "../../api";
import { firstError } from "../../form";
import { useCampusMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, TextField } from "../ui";

export function CampusFormDialog({
	campus,
	onClose,
}: {
	campus?: Campus;
	onClose: () => void;
}) {
	const { createCampus, updateCampus } = useCampusMutations();
	const isEdit = campus !== undefined;
	const [serverError, setServerError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			name: campus?.name ?? "",
			address: campus?.address ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			const input = {
				name: value.name.trim(),
				address: value.address.trim() || undefined,
			};
			try {
				if (isEdit) {
					await updateCampus.mutateAsync({ id: campus.id, input });
					toastSuccess("Campus updated", input.name);
				} else {
					await createCampus.mutateAsync(input);
					toastSuccess("Campus created", input.name);
				}
				onClose();
			} catch (error) {
				setServerError(errorMessage(error));
				toastApiError(
					error,
					isEdit
						? "Campus could not be updated"
						: "Campus could not be created",
				);
			}
		},
	});

	const pending = createCampus.isPending || updateCampus.isPending;

	return (
		<Dialog
			title={isEdit ? "Edit campus" : "Add campus"}
			description={
				isEdit
					? "Rename the campus or correct its address."
					: "Campuses hold floors, and floors hold rooms."
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
								form="campus-form"
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
								{isEdit ? "Save campus" : "Create campus"}
							</Button>
						)}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="campus-form"
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
							value.trim() ? undefined : "Enter a campus name.",
					}}
				>
					{(field) => (
						<TextField
							label="Campus name"
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
							placeholder="Main Campus"
							autoFocus
							disabled={pending}
						/>
					)}
				</form.Field>

				<form.Field name="address">
					{(field) => (
						<TextField
							label="Address"
							value={field.state.value}
							onChange={(next) => field.handleChange(next)}
							onBlur={() => field.handleBlur()}
							placeholder="12 Learning Way"
							disabled={pending}
							hint="Optional."
						/>
					)}
				</form.Field>
			</form>
		</Dialog>
	);
}
