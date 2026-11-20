import { CircleNotch, Minus, Plus } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { ApiError, type Campus, errorMessage, type Story } from "../../api";
import { firstError, parseInteger } from "../../form";
import { useCampusMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, IconButton, TextField } from "../ui";

/** Where new floors start stacking: one level above the campus' highest one. */
function nextFloorNumber(campus: Campus): number {
	return (
		campus.stories.reduce((top, story) => Math.max(top, story.floor), 0) + 1
	);
}

/** "Floor 4" or "Floors 4–6", for the hint and the success toast. */
function floorRange(start: number, count: number): string {
	return count === 1
		? `Floor ${start}`
		: `Floors ${start}–${start + count - 1}`;
}

const MAX_PREVIEW = 8;

/** Mini elevation of the building: new floors glow on top of the existing
 * ones, so the user sees exactly where they land before saving. */
function StackPreview({ campus, adding }: { campus: Campus; adding: number }) {
	const existing = [...campus.stories].sort((a, b) => b.floor - a.floor);
	const start = nextFloorNumber(campus);
	const added = Array.from(
		{ length: Math.max(adding, 0) },
		(_, index) => start + index,
	).reverse();
	const rows = [
		...added.map((floor) => ({ floor, fresh: true, label: "New" })),
		...existing.map((story) => ({
			floor: story.floor,
			fresh: false,
			label: story.name || `${story.classes.length} classes`,
		})),
	];
	const hidden = Math.max(rows.length - MAX_PREVIEW, 0);
	return (
		<div className="stack-preview" aria-hidden="true">
			<span className="stack-preview__roof" />
			<ol className="stack-preview__body">
				{rows.slice(0, MAX_PREVIEW).map((row) => (
					<li
						key={`${row.fresh ? "n" : "e"}${row.floor}`}
						className={[
							"stack-preview__floor",
							row.fresh ? "stack-preview__floor--new" : "",
						].join(" ")}
					>
						<span className="stack-preview__level num">{row.floor}</span>
						<span className="stack-preview__label">{row.label}</span>
					</li>
				))}
				{hidden > 0 ? (
					<li className="stack-preview__more num">+{hidden} more below</li>
				) : null}
			</ol>
			<span className="stack-preview__ground" />
		</div>
	);
}

export function StoryFormDialog({
	campus,
	story,
	onClose,
}: {
	campus: Campus;
	story?: Story;
	onClose: () => void;
}) {
	const { createStory, updateStory } = useCampusMutations();
	const isEdit = story !== undefined;
	// New floors stack on top of the building, so the form asks how many to add
	// rather than making the user work out the next floor number.
	const start = nextFloorNumber(campus);
	const [serverError, setServerError] = useState<string | null>(null);
	const [floorError, setFloorError] = useState<string | null>(null);
	const [countError, setCountError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: {
			floor: story ? String(story.floor) : "",
			count: "1",
			name: story?.name ?? "",
		},
		onSubmit: async ({ value }) => {
			setServerError(null);
			setFloorError(null);
			setCountError(null);

			if (isEdit) {
				const floor = parseInteger(value.floor);
				if (floor === null) return;
				const input = { floor, name: value.name.trim() || undefined };
				try {
					await updateStory.mutateAsync({ id: story.id, input });
					toastSuccess("Floor updated", `Floor ${floor}`);
					onClose();
				} catch (error) {
					const message = errorMessage(error);
					if (error instanceof ApiError && error.status === 409) {
						// The API's duplicate-floor conflict belongs on the floor field.
						setFloorError(`Floor ${floor} already exists on this campus.`);
						toastApiError(error);
						return;
					}
					setServerError(message);
					toastApiError(error, "Floor could not be updated");
				}
				return;
			}

			const count = parseInteger(value.count);
			if (count === null || count < 1) return;
			const name = value.name.trim();
			try {
				for (let index = 0; index < count; index += 1) {
					await createStory.mutateAsync({
						campusId: campus.id,
						input: {
							floor: start + index,
							// A name describes one floor, so it only applies when a
							// single floor is being added.
							name: count === 1 && name ? name : undefined,
						},
					});
				}
				toastSuccess(
					count === 1 ? "Floor added" : `${count} floors added`,
					`${floorRange(start, count)} in ${campus.name}`,
				);
				onClose();
			} catch (error) {
				const message = errorMessage(error);
				if (error instanceof ApiError && error.status === 409) {
					setCountError("This campus already has a floor in that range.");
					toastApiError(error);
					return;
				}
				setServerError(message);
				toastApiError(
					error,
					count === 1
						? "Floor could not be added"
						: "Some floors could not be added",
				);
			}
		},
	});

	const pending = createStory.isPending || updateStory.isPending;

	const nameField = (
		<form.Field name="name">
			{(field) => (
				<TextField
					label="Floor name"
					value={field.state.value}
					onChange={(next) => field.handleChange(next)}
					onBlur={() => field.handleBlur()}
					placeholder="Ground floor"
					disabled={pending}
					hint="Optional, e.g. “Science wing”."
				/>
			)}
		</form.Field>
	);

	return (
		<Dialog
			title={isEdit ? "Edit floor" : "Add floors"}
			description={
				isEdit
					? `${campus.name} — renumber or rename this floor.`
					: `${campus.name} — new floors stack on top of the building.`
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
								state.isSubmitting,
								state.values.floor,
								state.values.count,
							] as const
						}
					>
						{([isSubmitting, floor, count]) => {
							const parsedCount = parseInteger(count);
							const valid = isEdit
								? parseInteger(floor) !== null
								: parsedCount !== null && parsedCount >= 1;
							const label = isEdit
								? "Save floor"
								: parsedCount !== null && parsedCount > 1
									? `Add ${parsedCount} floors`
									: "Add floor";
							return (
								<Button
									type="submit"
									form="story-form"
									variant="primary"
									disabled={!valid || isSubmitting || pending}
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
									{label}
								</Button>
							);
						}}
					</form.Subscribe>
				</>
			}
		>
			<form
				id="story-form"
				className="stack--sm"
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				{isEdit ? (
					<form.Field
						name="floor"
						validators={{
							onChange: ({ value }) =>
								parseInteger(value) === null
									? "Enter a whole floor number."
									: undefined,
						}}
					>
						{(field) => (
							<TextField
								label="Floor"
								type="number"
								inputMode="numeric"
								value={field.state.value}
								onChange={(next) => {
									setFloorError(null);
									setServerError(null);
									field.handleChange(next);
								}}
								onBlur={() => field.handleBlur()}
								error={
									floorError ??
									(field.state.meta.isDirty
										? firstError(field.state.meta.errors)
										: undefined)
								}
								placeholder="1"
								autoFocus
								disabled={pending}
							/>
						)}
					</form.Field>
				) : (
					<form.Field
						name="count"
						validators={{
							onChange: ({ value }) => {
								const count = parseInteger(value);
								return count === null || count < 1
									? "Enter how many floors to add, at least 1."
									: undefined;
							},
						}}
					>
						{(field) => {
							const count = parseInteger(field.state.value);
							const set = (next: number) => {
								setCountError(null);
								setServerError(null);
								field.handleChange(String(Math.max(1, Math.min(next, 50))));
							};
							const error =
								countError ??
								(field.state.meta.isDirty
									? firstError(field.state.meta.errors)
									: undefined);
							return (
								<div className="floor-adder">
									<StackPreview campus={campus} adding={count ?? 0} />
									<div className="floor-adder__controls">
										<span className="field__label" id="floor-count-label">
											How many floors
										</span>
										<div
											className="stepper"
											role="group"
											aria-labelledby="floor-count-label"
										>
											<IconButton
												label="One fewer floor"
												icon={
													<Minus size={14} weight="bold" aria-hidden="true" />
												}
												onClick={() => set((count ?? 1) - 1)}
												disabled={pending || (count ?? 1) <= 1}
											/>
											<input
												className="stepper__value num"
												type="number"
												inputMode="numeric"
												min={1}
												max={50}
												aria-labelledby="floor-count-label"
												value={field.state.value}
												onChange={(event) => {
													setCountError(null);
													setServerError(null);
													field.handleChange(event.target.value);
												}}
												onBlur={() => field.handleBlur()}
												disabled={pending}
												// biome-ignore lint/a11y/noAutofocus: dialog's primary input
												autoFocus
											/>
											<IconButton
												label="One more floor"
												icon={
													<Plus size={14} weight="bold" aria-hidden="true" />
												}
												onClick={() => set((count ?? 0) + 1)}
												disabled={pending || (count ?? 0) >= 50}
											/>
										</div>
										<p
											className={error ? "field__error" : "field__description"}
											aria-live="polite"
										>
											{error ??
												(count !== null && count >= 1
													? `Adds ${floorRange(start, count)} on top.`
													: "Enter at least 1.")}
										</p>
									</div>
								</div>
							);
						}}
					</form.Field>
				)}

				{isEdit ? (
					nameField
				) : (
					// A name describes a single floor, so it is only offered when one
					// floor is being added.
					<form.Subscribe selector={(state) => state.values.count}>
						{(count) => (parseInteger(count) === 1 ? nameField : null)}
					</form.Subscribe>
				)}
			</form>
		</Dialog>
	);
}
