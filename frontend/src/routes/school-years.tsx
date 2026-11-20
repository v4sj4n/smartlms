import {
	Books,
	CalendarBlank,
	CheckCircle,
	DotsThree,
	Info,
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
	CardFooter,
	CardHeader,
	EmptyState,
	ErrorState,
	InlineNote,
	Menu,
	PageHeader,
	SkeletonStack,
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

/* ---------- the calendar rail ---------- */

// An academic year starts in September, so the rail runs Sep → Aug.
const RAIL_START_MONTH = 8;

const MONTH_NAME = new Intl.DateTimeFormat(undefined, { month: "short" });

type MonthCell = {
	key: string;
	label: string;
	/** The month falls inside the year's start–end range. */
	covered: boolean;
	/** Today is in this month, and in a covered one. */
	current: boolean;
};

function parseDay(value?: string): Date | null {
	if (!value) return null;
	const date = new Date(`${value}T00:00:00`);
	return Number.isNaN(date.getTime()) ? null : date;
}

function monthCells(year: SchoolYear, today = new Date()): MonthCell[] {
	const cells: MonthCell[] = [];
	for (let i = 0; i < 12; i += 1) {
		const month = (RAIL_START_MONTH + i) % 12;
		cells.push({
			key: `${year.id}-${i}`,
			label: MONTH_NAME.format(new Date(2024, month, 1)),
			covered: false,
			current: false,
		});
	}

	const start = parseDay(year.starts_on);
	const end = parseDay(year.ends_on);
	if (!start || !end) return cells;

	const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
	const last = new Date(end.getFullYear(), end.getMonth(), 1);
	while (cursor.getTime() <= last.getTime()) {
		cells[(cursor.getMonth() - RAIL_START_MONTH + 12) % 12].covered = true;
		cursor.setMonth(cursor.getMonth() + 1);
	}

	if (year.is_active) {
		const now = cells[(today.getMonth() - RAIL_START_MONTH + 12) % 12];
		now.current = now.covered;
	}
	return cells;
}

/** Which months the year runs, as one bar per month. Decorative: the dates
 * above it carry the same information for screen readers. */
function MonthRail({ year }: { year: SchoolYear }) {
	return (
		<span className="month-rail" aria-hidden="true">
			{monthCells(year).map((cell) => (
				<span
					key={cell.key}
					className="month-rail__month"
					data-covered={cell.covered || undefined}
					data-current={cell.current || undefined}
				>
					<span className="month-rail__bar" />
					<span className="month-rail__label">{cell.label}</span>
				</span>
			))}
		</span>
	);
}

/* ---------- one year ---------- */

function YearRow({
	year,
	canManage,
	busy,
	onActivate,
	onDialog,
}: {
	year: SchoolYear;
	canManage: boolean;
	busy: boolean;
	onActivate: () => void;
	onDialog: (dialog: DialogState) => void;
}) {
	return (
		<li
			className={["year-item", year.is_active ? "year-item--current" : ""]
				.filter(Boolean)
				.join(" ")}
		>
			<div className="year-item__main">
				<div className="year-item__head">
					<span className="year-item__name num">{year.name}</span>
					{year.is_active ? (
						<Badge
							tone="success"
							icon={
								<CheckCircle size={12} weight="regular" aria-hidden="true" />
							}
						>
							Current
						</Badge>
					) : (
						<Badge tone="outline">Archived</Badge>
					)}
					<span className="year-item__dates num">{runDates(year)}</span>
				</div>
				<MonthRail year={year} />
			</div>

			<div className="year-item__side">
				<span className="year-item__subjects num">
					<Books size={13} weight="regular" aria-hidden="true" />
					{plural(year.subjects, "subject", "subjects")}
				</span>
				{canManage ? (
					<div className="year-item__actions">
						{year.is_active ? null : (
							<Button
								variant="secondary"
								size="sm"
								onClick={onActivate}
								disabled={busy}
							>
								Make current
							</Button>
						)}
						<Menu
							aria-label={`Manage ${year.name}`}
							trigger={<DotsThree size={16} weight="bold" aria-hidden="true" />}
							triggerClassName="icon-btn"
							items={[
								{
									key: "edit",
									label: "Edit school year",
									icon: (
										<PencilSimple
											size={14}
											weight="regular"
											aria-hidden="true"
										/>
									),
									onSelect: () => onDialog({ kind: "edit", year }),
								},
								{
									key: "delete",
									label: "Delete school year",
									icon: <Trash size={14} weight="regular" aria-hidden="true" />,
									destructive: true,
									onSelect: () => onDialog({ kind: "delete", year }),
								},
							]}
						/>
					</div>
				) : null}
			</div>
		</li>
	);
}

/* ---------- page ---------- */

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

	// Newest first: the timeline reads down from the year in use.
	const items = [...(years.data?.items ?? [])].sort((a, b) =>
		b.name.localeCompare(a.name),
	);

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
			) : items.length === 0 ? (
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
				<Card>
					<CardHeader
						icon={
							<span className="card__mark" aria-hidden="true">
								<CalendarBlank size={15} weight="regular" />
							</span>
						}
						title="Academic calendar"
						hint={
							<span className="num">
								{plural(items.length, "year", "years")}
							</span>
						}
					/>
					<ul className="year-list">
						{items.map((year) => (
							<YearRow
								key={year.id}
								year={year}
								canManage={canManage}
								busy={activateSchoolYear.isPending}
								onActivate={() => void activate(year)}
								onDialog={setDialog}
							/>
						))}
					</ul>
					<CardFooter>
						<span className="year-note">
							<Info size={13} weight="regular" aria-hidden="true" />
							<span>
								Subjects belong to exactly one year; activating another year
								archives the previous one without touching its content. A year
								that is current or still holds subjects cannot be deleted —
								rename it instead.
							</span>
						</span>
					</CardFooter>
				</Card>
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
						dialog.year.subjects > 0 ? (
							<>
								<strong>
									{plural(dialog.year.subjects, "subject is", "subjects are")}
								</strong>{" "}
								still filed under this year, so the year cannot be deleted yet.
							</>
						) : (
							"Nothing is filed under this year, so nothing else changes."
						)
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
