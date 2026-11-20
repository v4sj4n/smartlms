import {
	Books,
	Cards,
	Chalkboard,
	DotsThree,
	Exam,
	List,
	LockKey,
	PencilSimple,
	Plus,
	Presentation,
	SquaresFour,
	Trash,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { api, errorMessage, type Subject } from "../api";
import { useAuth } from "../auth";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ModuleGate } from "../components/ModuleGate";
import { SubjectFormDialog } from "../components/subjects/SubjectFormDialog";
import {
	Badge,
	Button,
	Card,
	Chip,
	EmptyState,
	ErrorState,
	InlineNote,
	Menu,
	PageHeader,
	type PageSize,
	Pagination,
	Select,
	SkeletonStack,
} from "../components/ui";
import { queryKeys, useSubjectMutations, useSubjects } from "../queries";
import {
	DEFAULT_PAGE_SIZE,
	type ListSearch,
	parseSubjectSearch,
	type SubjectSearch,
} from "../search";
import { appLayoutRoute } from "./app-layout";

type DialogState =
	| "create"
	| { kind: "edit"; subject: Subject }
	| { kind: "delete"; subject: Subject }
	| null;

type ViewMode = "grid" | "list";
const VIEW_STORAGE_KEY = "optimolms.subjects.view";

function readViewMode(): ViewMode {
	try {
		return localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid";
	} catch {
		return "grid";
	}
}

function ViewToggle({
	value,
	onChange,
}: {
	value: ViewMode;
	onChange: (next: ViewMode) => void;
}) {
	const options: { mode: ViewMode; label: string; icon: ReactNode }[] = [
		{
			mode: "grid",
			label: "Grid view",
			icon: <SquaresFour size={15} weight="regular" aria-hidden="true" />,
		},
		{
			mode: "list",
			label: "List view",
			icon: <List size={15} weight="regular" aria-hidden="true" />,
		},
	];
	return (
		<div className="segmented" role="group" aria-label="Layout">
			{options.map((option) => (
				<button
					key={option.mode}
					type="button"
					className={`segmented__option segmented__option--icon${value === option.mode ? " segmented__option--active" : ""}`}
					aria-label={option.label}
					aria-pressed={value === option.mode}
					title={option.label}
					onClick={() => onChange(option.mode)}
				>
					{option.icon}
				</button>
			))}
		</div>
	);
}

function CountChip({
	icon,
	value,
	label,
}: {
	icon: ReactNode;
	value: number;
	label: string;
}) {
	return (
		<Chip tone={value === 0 ? "muted" : "default"} title={`${value} ${label}`}>
			{icon}
			<span className="num">{value}</span>
		</Chip>
	);
}

function SubjectRow({
	subject,
	canManage,
	onDialog,
	tile = false,
}: {
	subject: Subject;
	canManage: boolean;
	onDialog: (dialog: DialogState) => void;
	tile?: boolean;
}) {
	return (
		<article
			className={tile ? "card subject-row subject-row--tile" : "subject-row"}
		>
			<div className="subject-row__main">
				<div className="subject-row__title">
					<Link
						to="/subjects/$subjectId"
						params={{ subjectId: subject.id }}
						className="subject-row__name"
					>
						{subject.name}
					</Link>
					{subject.code ? <Badge tone="outline">{subject.code}</Badge> : null}
				</div>
				<p className="subject-row__meta">
					<span>{subject.lecturer_name ?? "No lecturer assigned"}</span>
					{subject.school_year ? (
						<Chip tone="muted" title="School year">
							{subject.school_year}
						</Chip>
					) : (
						<Chip tone="muted" title="Not filed under a school year">
							No school year
						</Chip>
					)}
					<Chip tone="muted" title="Semester">
						{subject.semester === "SECOND" ? "Semester II" : "Semester I"}
					</Chip>
				</p>
				{subject.description ? (
					<p className="subject-row__description">{subject.description}</p>
				) : null}
			</div>

			<div className="subject-row__counts">
				<CountChip
					icon={<Chalkboard size={13} weight="regular" aria-hidden="true" />}
					value={subject.counts.lectures}
					label="lectures"
				/>
				<CountChip
					icon={<Presentation size={13} weight="regular" aria-hidden="true" />}
					value={subject.counts.assignments}
					label="assignments"
				/>
				<CountChip
					icon={<Exam size={13} weight="regular" aria-hidden="true" />}
					value={subject.counts.quizzes}
					label="quizzes"
				/>
				<CountChip
					icon={<Cards size={13} weight="regular" aria-hidden="true" />}
					value={subject.counts.flashcard_sets}
					label="flashcard sets"
				/>
			</div>

			{canManage ? (
				<div className="subject-row__menu">
					<Menu
						aria-label={`Manage ${subject.name}`}
						trigger={<DotsThree size={16} weight="bold" aria-hidden="true" />}
						triggerClassName="icon-btn"
						items={[
							{
								key: "edit",
								label: "Edit subject",
								icon: (
									<PencilSimple size={14} weight="regular" aria-hidden="true" />
								),
								onSelect: () => onDialog({ kind: "edit", subject }),
							},
							{
								key: "delete",
								label: "Delete subject",
								icon: <Trash size={14} weight="regular" aria-hidden="true" />,
								destructive: true,
								onSelect: () => onDialog({ kind: "delete", subject }),
							},
						]}
					/>
				</div>
			) : null}
		</article>
	);
}

function SubjectsPage() {
	const {
		page = 1,
		page_size = DEFAULT_PAGE_SIZE,
		school_year,
	} = subjectsRoute.useSearch();
	const navigate = useNavigate();
	const { hasPermission, hasModule } = useAuth();
	// The year filter is built from the school-years catalogue, which is a
	// different module: students hold neither the module nor its permission, so
	// asking for it would 403 in the background and leave a filter with nothing
	// in it but "All school years". Callers without it get no filter at all, and
	// a school_year left in an old link is ignored rather than applied invisibly
	// — the list keeps working for them, and every row names its own year.
	const canFilterByYear =
		hasModule("school-years") || hasPermission("school-years.view");
	const yearFilter = canFilterByYear ? school_year : undefined;
	const subjects = useSubjects({ page, page_size, school_year: yearFilter });
	const schoolYears = useQuery({
		queryKey: queryKeys.schoolYears,
		queryFn: api.schoolYears,
		staleTime: 30_000,
		enabled: canFilterByYear,
	});
	const { deleteSubject } = useSubjectMutations();
	const [dialog, setDialog] = useState<DialogState>(null);
	const [view, setViewState] = useState<ViewMode>(readViewMode);
	const setView = (next: ViewMode) => {
		setViewState(next);
		try {
			localStorage.setItem(VIEW_STORAGE_KEY, next);
		} catch {
			// Private mode: the choice just lasts for this visit.
		}
	};
	const canManage = hasPermission("subjects.manage");

	const goToPage = (next: number) => {
		void navigate({
			to: "/subjects",
			search: (previous: Partial<ListSearch>) => ({
				...previous,
				page: Math.max(1, next),
			}),
		});
	};

	// Changing the year starts again from page 1: page 3 of one year is rarely
	// page 3 of another.
	const setYear = (next: string) => {
		void navigate({
			to: "/subjects",
			search: (previous: Partial<SubjectSearch>) => ({
				...previous,
				page: 1,
				school_year: next || undefined,
			}),
		});
	};

	const setPageSize = (size: PageSize) => {
		void navigate({
			to: "/subjects",
			search: (previous: Partial<ListSearch>) => ({
				...previous,
				page: 1,
				page_size: size,
			}),
		});
	};

	return (
		<ModuleGate moduleKey="subjects">
			<PageHeader
				title="Subjects"
				description="Each subject owns its lectures, seminars, quizzes and flashcards."
				actions={
					<>
						<ViewToggle value={view} onChange={setView} />
						{canFilterByYear ? (
							<Select
								compact
								aria-label="Filter subjects by school year"
								value={yearFilter ?? ""}
								onChange={setYear}
								options={[
									{ value: "", label: "All school years" },
									...(schoolYears.data?.items ?? []).map((year) => ({
										value: year.name,
										label: year.is_active
											? `${year.name} · current`
											: year.name,
									})),
								]}
							/>
						) : null}
						{canManage ? (
							<Button
								variant="primary"
								size="sm"
								icon={<Plus size={15} weight="bold" aria-hidden="true" />}
								onClick={() => setDialog("create")}
							>
								New subject
							</Button>
						) : (
							<Badge
								tone="outline"
								icon={<LockKey size={12} weight="regular" aria-hidden="true" />}
							>
								View only
							</Badge>
						)}
					</>
				}
			/>

			{!canManage ? (
				<Card>
					<InlineNote>
						Your role can read subjects but not change them. Creating, editing
						and deleting needs the <code>subjects.manage</code> permission.
					</InlineNote>
				</Card>
			) : null}

			{subjects.isPending ? (
				<Card>
					<SkeletonStack rows={6} />
				</Card>
			) : subjects.isError ? (
				<Card>
					<ErrorState
						title="Subjects could not be loaded"
						message={errorMessage(subjects.error)}
						onRetry={() => void subjects.refetch()}
					/>
				</Card>
			) : subjects.data.items.length === 0 ? (
				<Card>
					<EmptyState
						icon={Books}
						title={
							yearFilter
								? `No subjects in ${yearFilter}`
								: "No subjects yet — create your first subject"
						}
						description={
							yearFilter
								? "Nothing is filed under this year yet. Widen the filter to see the other years."
								: canManage
									? "A subject groups its own lectures, seminars, quizzes and flashcards."
									: "Once a lecturer or administrator adds a subject it appears here."
						}
						action={
							yearFilter ? (
								<Button
									variant="secondary"
									size="sm"
									onClick={() => setYear("")}
								>
									Show all school years
								</Button>
							) : canManage ? (
								<Button
									variant="primary"
									size="sm"
									icon={<Plus size={15} weight="bold" aria-hidden="true" />}
									onClick={() => setDialog("create")}
								>
									New subject
								</Button>
							) : null
						}
					/>
				</Card>
			) : (
				<div className="subject-results">
					{view === "grid" ? (
						<div className="subject-grid">
							{subjects.data.items.map((subject) => (
								<SubjectRow
									key={subject.id}
									subject={subject}
									canManage={canManage}
									onDialog={setDialog}
									tile
								/>
							))}
						</div>
					) : (
						<Card className="card--flush">
							<div className="subject-list">
								{subjects.data.items.map((subject) => (
									<SubjectRow
										key={subject.id}
										subject={subject}
										canManage={canManage}
										onDialog={setDialog}
									/>
								))}
							</div>
						</Card>
					)}
					<Card className="card--flush">
						<div className="card__footer">
							<Pagination
								page={page}
								pageSize={page_size}
								total={subjects.data.total}
								itemLabel="subjects"
								onPageChange={goToPage}
								onPageSizeChange={setPageSize}
							/>
						</div>
					</Card>
				</div>
			)}

			{dialog === "create" ? (
				<SubjectFormDialog onClose={() => setDialog(null)} />
			) : null}

			{dialog !== null && dialog !== "create" && dialog.kind === "edit" ? (
				<SubjectFormDialog
					subject={dialog.subject}
					onClose={() => setDialog(null)}
				/>
			) : null}

			{dialog !== null && dialog !== "create" && dialog.kind === "delete" ? (
				<ConfirmDialog
					title={`Delete ${dialog.subject.name}?`}
					description="The subject and all content inside it is removed."
					consequences={
						<>
							This deletes <strong>{dialog.subject.counts.lectures}</strong>{" "}
							lectures, <strong>{dialog.subject.counts.assignments}</strong>{" "}
							assignments, <strong>{dialog.subject.counts.quizzes}</strong>{" "}
							quizzes and{" "}
							<strong>{dialog.subject.counts.flashcard_sets}</strong> flashcard
							sets. This cannot be undone.
						</>
					}
					confirmLabel="Delete subject"
					successMessage="Subject deleted"
					onConfirm={() => deleteSubject.mutateAsync(dialog.subject.id)}
					onClose={() => setDialog(null)}
				/>
			) : null}
		</ModuleGate>
	);
}

export const subjectsRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/subjects",
	validateSearch: parseSubjectSearch,
	component: SubjectsPage,
});
