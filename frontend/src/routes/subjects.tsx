import {
	Books,
	Cards,
	Chalkboard,
	Exam,
	LockKey,
	PencilSimple,
	Plus,
	Presentation,
	Trash,
} from "@phosphor-icons/react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { errorMessage, type Subject } from "../api";
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
	IconButton,
	InlineNote,
	PageHeader,
	type PageSize,
	Pagination,
	Select,
	SkeletonStack,
} from "../components/ui";
import { useSchoolYears, useSubjectMutations, useSubjects } from "../queries";
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
}: {
	subject: Subject;
	canManage: boolean;
	onDialog: (dialog: DialogState) => void;
}) {
	return (
		<article className="subject-row">
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
					value={subject.counts.flashcards}
					label="flashcards"
				/>
			</div>

			<div className="subject-row__actions">
				<Link
					to="/subjects/$subjectId"
					params={{ subjectId: subject.id }}
					className="btn btn--secondary btn--sm"
				>
					Open
				</Link>
				{canManage ? (
					<>
						<IconButton
							label={`Edit ${subject.name}`}
							icon={
								<PencilSimple size={15} weight="regular" aria-hidden="true" />
							}
							onClick={() => onDialog({ kind: "edit", subject })}
						/>
						<IconButton
							label={`Delete ${subject.name}`}
							icon={<Trash size={15} weight="regular" aria-hidden="true" />}
							tone="danger"
							onClick={() => onDialog({ kind: "delete", subject })}
						/>
					</>
				) : null}
			</div>
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
	const subjects = useSubjects({ page, page_size, school_year });
	const schoolYears = useSchoolYears();
	const { hasPermission } = useAuth();
	const { deleteSubject } = useSubjectMutations();
	const [dialog, setDialog] = useState<DialogState>(null);
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
						<Select
							compact
							aria-label="Filter subjects by school year"
							value={school_year ?? ""}
							onChange={setYear}
							options={[
								{ value: "", label: "All school years" },
								...(schoolYears.data?.items ?? []).map((year) => ({
									value: year.name,
									label: year.is_active ? `${year.name} · current` : year.name,
								})),
							]}
						/>
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
							school_year
								? `No subjects in ${school_year}`
								: "No subjects yet — create your first subject"
						}
						description={
							school_year
								? "Nothing is filed under this year yet. Widen the filter to see the other years."
								: canManage
									? "A subject groups its own lectures, seminars, quizzes and flashcards."
									: "Once a lecturer or administrator adds a subject it appears here."
						}
						action={
							school_year ? (
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
							quizzes and <strong>{dialog.subject.counts.flashcards}</strong>{" "}
							flashcards. This cannot be undone.
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
