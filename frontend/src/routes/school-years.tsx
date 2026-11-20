import {
	CalendarBlank,
	CheckCircle,
	LockKey,
	PencilSimple,
	Plus,
	Trash,
} from "@phosphor-icons/react";
import { createRoute } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage, type SchoolYear } from "../api";
import { useAuth } from "../auth";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ModuleGate } from "../components/ModuleGate";
import { SchoolYearFormDialog } from "../components/school-years/SchoolYearFormDialog";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	ErrorState,
	IconButton,
	InlineNote,
	PageHeader,
	SkeletonStack,
	Table,
	Td,
	Th,
} from "../components/ui";
import { formatDate } from "../format";
import { useSchoolYearMutations, useSchoolYears } from "../queries";
import { toastApiError, toastSuccess } from "../toast";
import { appLayoutRoute } from "./app-layout";

type DialogState =
	| "create"
	| { kind: "edit"; year: SchoolYear }
	| { kind: "delete"; year: SchoolYear }
	| null;

/** "1 Sep 2026 – 30 Jun 2027", or an honest admission that none were set. */
function runDates(year: SchoolYear): string {
	if (!year.starts_on && !year.ends_on) return "No dates set";
	const start = year.starts_on ? formatDate(year.starts_on) : "—";
	const end = year.ends_on ? formatDate(year.ends_on) : "—";
	return `${start} – ${end}`;
}

const plural = (count: number, one: string, many: string) =>
	`${count} ${count === 1 ? one : many}`;

function SchoolYearsPage() {
	const years = useSchoolYears();
	const { hasPermission } = useAuth();
	const { activateSchoolYear, deleteSchoolYear } = useSchoolYearMutations();
	const [dialog, setDialog] = useState<DialogState>(null);
	const canManage = hasPermission("school-years.manage");

	const activate = async (year: SchoolYear) => {
		try {
			await activateSchoolYear.mutateAsync(year.id);
			toastSuccess(
				"Current school year",
				`${year.name} is now the current year.`,
			);
		} catch (error) {
			toastApiError(error, "The school year could not be made current");
		}
	};

	const active = years.data?.items.find((year) => year.is_active);

	return (
		<ModuleGate moduleKey="school-years">
			<PageHeader
				title="School years"
				description="The academic calendar. One year is current; subjects, grades and study records are filed under the year they belong to."
				actions={
					canManage ? (
						<Button
							variant="primary"
							size="sm"
							icon={<Plus size={15} weight="bold" aria-hidden="true" />}
							onClick={() => setDialog("create")}
						>
							New school year
						</Button>
					) : (
						<Badge
							tone="outline"
							icon={<LockKey size={12} weight="regular" aria-hidden="true" />}
						>
							View only
						</Badge>
					)
				}
			/>

			{!canManage ? (
				<Card>
					<InlineNote>
						Your role can read the calendar but not change it. Creating, editing
						and activating a year needs the <code>school-years.manage</code>{" "}
						permission.
					</InlineNote>
				</Card>
			) : null}

			{years.isPending ? (
				<Card>
					<SkeletonStack rows={4} />
				</Card>
			) : years.isError ? (
				<Card>
					<ErrorState
						title="School years could not be loaded"
						message={errorMessage(years.error)}
						onRetry={() => void years.refetch()}
					/>
				</Card>
			) : years.data.items.length === 0 ? (
				<Card>
					<EmptyState
						icon={CalendarBlank}
						title="No school years yet"
						description={
							canManage
								? "Add the year the school is running now. New subjects are scheduled into it."
								: "Once an administrator adds the academic calendar it appears here."
						}
						action={
							canManage ? (
								<Button
									variant="primary"
									size="sm"
									icon={<Plus size={15} weight="bold" aria-hidden="true" />}
									onClick={() => setDialog("create")}
								>
									New school year
								</Button>
							) : null
						}
					/>
				</Card>
			) : (
				<>
					<Card className="card--flush">
						<header className="card__header">
							<div className="card__heading">
								{active ? (
									<>
										<span className="card__title">{active.name}</span>
										<Badge
											tone="success"
											icon={
												<CheckCircle
													size={12}
													weight="regular"
													aria-hidden="true"
												/>
											}
										>
											Current
										</Badge>
										<span className="card__hint">
											{plural(active.subjects, "subject", "subjects")} ·{" "}
											{runDates(active)}
										</span>
									</>
								) : (
									<span className="card__hint">
										No current year — new subjects stay unfiled until one is
										made current.
									</span>
								)}
							</div>
						</header>

						<Table caption="School years">
							<thead>
								<tr>
									<Th>Year</Th>
									<Th>Runs</Th>
									<Th align="right">Subjects</Th>
									<Th>Status</Th>
									<Th align="right">Actions</Th>
								</tr>
							</thead>
							<tbody>
								{years.data.items.map((year) => (
									<tr key={year.id}>
										<Td>
											<span className="table__primary">{year.name}</span>
										</Td>
										<Td>
											<span className="table__secondary">{runDates(year)}</span>
										</Td>
										<Td align="right">
											<span className="table__num-cell num">
												{year.subjects}
											</span>
										</Td>
										<Td>
											{year.is_active ? (
												<Badge
													tone="success"
													icon={
														<CheckCircle
															size={12}
															weight="regular"
															aria-hidden="true"
														/>
													}
												>
													Current
												</Badge>
											) : (
												<Badge tone="outline">Archived</Badge>
											)}
										</Td>
										<Td align="right">
											<span className="table__inline">
												{canManage && !year.is_active ? (
													<Button
														variant="secondary"
														size="sm"
														onClick={() => void activate(year)}
														disabled={activateSchoolYear.isPending}
													>
														Make current
													</Button>
												) : null}
												{canManage ? (
													<>
														<IconButton
															label={`Edit ${year.name}`}
															icon={
																<PencilSimple
																	size={15}
																	weight="regular"
																	aria-hidden="true"
																/>
															}
															onClick={() => setDialog({ kind: "edit", year })}
														/>
														<IconButton
															label={`Delete ${year.name}`}
															icon={
																<Trash
																	size={15}
																	weight="regular"
																	aria-hidden="true"
																/>
															}
															tone="danger"
															onClick={() =>
																setDialog({ kind: "delete", year })
															}
														/>
													</>
												) : null}
											</span>
										</Td>
									</tr>
								))}
							</tbody>
						</Table>
					</Card>

					<Card>
						<InlineNote>
							Subjects belong to exactly one year, and activating another year
							archives the previous one without touching its content. A year
							that is current or still holds subjects cannot be deleted — rename
							it instead, and everything filed under it follows.
						</InlineNote>
					</Card>
				</>
			)}

			{dialog === "create" ? (
				<SchoolYearFormDialog canActivate onClose={() => setDialog(null)} />
			) : null}

			{dialog !== null && dialog !== "create" && dialog.kind === "edit" ? (
				<SchoolYearFormDialog
					schoolYear={dialog.year}
					canActivate={!dialog.year.is_active}
					onClose={() => setDialog(null)}
				/>
			) : null}

			{dialog !== null && dialog !== "create" && dialog.kind === "delete" ? (
				<ConfirmDialog
					title={`Delete ${dialog.year.name}?`}
					description="The year is removed from the academic calendar. Subjects are never deleted with it."
					consequences={
						<>
							{dialog.year.subjects > 0 ? (
								<>
									<strong>
										{plural(dialog.year.subjects, "subject is", "subjects are")}
									</strong>{" "}
									still filed under this year, so the year cannot be deleted
									yet.
								</>
							) : (
								"Nothing is filed under this year, so nothing else changes."
							)}
						</>
					}
					confirmLabel="Delete school year"
					successMessage="School year deleted"
					onConfirm={() => deleteSchoolYear.mutateAsync(dialog.year.id)}
					onClose={() => setDialog(null)}
				/>
			) : null}
		</ModuleGate>
	);
}

export const schoolYearsRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/school-years",
	component: SchoolYearsPage,
});
