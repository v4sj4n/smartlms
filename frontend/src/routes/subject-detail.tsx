import {
	Books,
	CalendarBlank,
	Cards,
	CaretLeft,
	Chalkboard,
	ChartBar,
	ChatCircle,
	Clock,
	Door,
	Exam,
	FileHtml,
	FilePdf,
	FileZip,
	ListChecks,
	LockKey,
	PencilSimple,
	Play,
	Plus,
	Presentation,
	Trash,
	UsersThree,
} from "@phosphor-icons/react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import {
	ApiError,
	type Assignment,
	type CourseWeek,
	errorMessage,
	type FlashcardSet,
	lectureFileUrl,
	type Quiz,
	type SessionItem,
	type SubjectDetail,
	type WeekItemKind,
} from "../api";
import { useAuth } from "../auth";
import { setChatMaterial } from "../chat/context";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ParticipantsPanel } from "../components/enrollments/ParticipantsPanel";
import { AccessGate } from "../components/ModuleGate";
import { AssignmentFormDialog } from "../components/subjects/AssignmentFormDialog";
import { FlashcardSetFormDialog } from "../components/subjects/FlashcardSetFormDialog";
import { FlashcardStudyDialog } from "../components/subjects/FlashcardStudyDialog";
import { ForumPanel } from "../components/subjects/ForumPanel";
import { GradebookPanel } from "../components/subjects/GradebookPanel";
import { QuizFormDialog } from "../components/subjects/QuizFormDialog";
import { SessionFormDialog } from "../components/subjects/SessionFormDialog";
import { SubjectFormDialog } from "../components/subjects/SubjectFormDialog";
import { SubjectGradeView } from "../components/subjects/SubjectGradeView";
import { WeekFormDialog } from "../components/subjects/WeekFormDialog";
import { WeeksPanel } from "../components/subjects/WeeksPanel";
import {
	Badge,
	Button,
	Card,
	Chip,
	EmptyState,
	ErrorState,
	IconButton,
	PageHeader,
	SkeletonStack,
} from "../components/ui";
import { formatBytes, formatDateTime } from "../format";
import {
	useAssignmentMutations,
	useStudentGrades,
	useSubject,
	useSubjectEnrollments,
	useSubjectMutations,
	useWeekMutations,
	useWeeks,
} from "../queries";
import { appLayoutRoute } from "./app-layout";

type Tab =
	| "weeks"
	| "lectures"
	| "assignments"
	| "quizzes"
	| "flashcards"
	| "grades"
	| "forums"
	| "participants";

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
	{
		key: "weeks",
		label: "Weeks",
		icon: <CalendarBlank size={14} weight="regular" aria-hidden="true" />,
	},
	{
		key: "lectures",
		label: "Lectures",
		icon: <Chalkboard size={14} weight="regular" aria-hidden="true" />,
	},
	{
		key: "assignments",
		label: "Assignments",
		icon: <Presentation size={14} weight="regular" aria-hidden="true" />,
	},
	{
		key: "quizzes",
		label: "Quizzes",
		icon: <Exam size={14} weight="regular" aria-hidden="true" />,
	},
	{
		key: "flashcards",
		label: "Flashcards",
		icon: <Cards size={14} weight="regular" aria-hidden="true" />,
	},
	{
		key: "grades",
		label: "Grades",
		icon: <ChartBar size={14} weight="regular" aria-hidden="true" />,
	},
	{
		key: "forums",
		label: "Forums",
		icon: <ChatCircle size={14} weight="regular" aria-hidden="true" />,
	},
	// Staff only: who sits in the subject. Not part of a student's subject page,
	// because the roster is the staff's view of the class, not the class's view
	// of itself.
	{
		key: "participants",
		label: "Participants",
		icon: <UsersThree size={14} weight="regular" aria-hidden="true" />,
	},
];

type DialogState =
	| { kind: "subject-edit" }
	| { kind: "subject-delete" }
	// The create dialogs carry the week they were opened from, so content added
	// with a week's + lands in that week without a second step.
	| { kind: "session-create"; weekId?: string }
	| { kind: "session-edit"; item: SessionItem }
	| { kind: "session-delete"; item: SessionItem }
	| { kind: "assignment-create"; weekId?: string }
	| { kind: "assignment-edit"; item: Assignment }
	| { kind: "assignment-delete"; item: Assignment }
	| { kind: "quiz-create"; weekId?: string }
	| { kind: "quiz-edit"; quiz: Quiz }
	| { kind: "quiz-delete"; quiz: Quiz }
	| { kind: "set-create"; weekId?: string }
	| { kind: "set-edit"; set: FlashcardSet }
	| { kind: "set-delete"; set: FlashcardSet }
	| { kind: "set-study"; set: FlashcardSet }
	| { kind: "week-create" }
	| { kind: "week-edit"; week: CourseWeek }
	| { kind: "week-delete"; week: CourseWeek }
	| null;

const LECTURE_FILE_ICON = {
	pdf: FilePdf,
	html: FileHtml,
	zip: FileZip,
} as const;

function SessionRow({
	item,
	canManage,
	onEdit,
	onDelete,
}: {
	item: SessionItem;
	canManage: boolean;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<article className="content-row">
			<div className="content-row__main">
				<h3 className="content-row__title">{item.title}</h3>
				{item.description ? (
					<p className="content-row__body">{item.description}</p>
				) : null}
				<div className="content-row__meta">
					<span className="row row--tight">
						<CalendarBlank size={13} weight="regular" aria-hidden="true" />
						{item.scheduled_at ? (
							<span className="num">{formatDateTime(item.scheduled_at)}</span>
						) : (
							<span>Not scheduled</span>
						)}
					</span>
					<span className="row row--tight">
						<Door size={13} weight="regular" aria-hidden="true" />
						{item.class_name ?? "No room"}
					</span>
				</div>
				{item.file
					? (() => {
							const Icon = LECTURE_FILE_ICON[item.file.type];
							const opensInline = item.file.type !== "zip";
							return (
								<a
									className="file-link"
									href={lectureFileUrl(item.id)}
									target={opensInline ? "_blank" : undefined}
									rel={opensInline ? "noopener noreferrer" : undefined}
									download={opensInline ? undefined : item.file.name}
								>
									<span
										className={`file-chip__icon file-chip__icon--${item.file.type}`}
									>
										<Icon size={16} weight="regular" aria-hidden="true" />
									</span>
									<span className="file-link__name">{item.file.name}</span>
									<span className="file-link__meta num">
										{item.file.type.toUpperCase()} ·{" "}
										{formatBytes(item.file.size)}
									</span>
									<span className="visually-hidden">
										{opensInline ? "(opens in a new tab)" : "(downloads)"}
									</span>
								</a>
							);
						})()
					: null}
			</div>
			{canManage ? (
				<div className="content-row__actions">
					<IconButton
						label={`Edit ${item.title}`}
						icon={
							<PencilSimple size={14} weight="regular" aria-hidden="true" />
						}
						onClick={onEdit}
					/>
					<IconButton
						label={`Delete ${item.title}`}
						icon={<Trash size={14} weight="regular" aria-hidden="true" />}
						tone="danger"
						onClick={onDelete}
					/>
				</div>
			) : null}
		</article>
	);
}

function AssignmentRow({
	item,
	canManage,
	onEdit,
	onDelete,
}: {
	item: Assignment;
	canManage: boolean;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const due = item.due_at ? new Date(item.due_at) : null;
	const overdue = due !== null && due.getTime() < Date.now();

	return (
		<article className="content-row">
			<div className="content-row__main">
				<h3 className="content-row__title">
					<Link
						to="/assignments/$assignmentId"
						params={{ assignmentId: item.id }}
					>
						{item.title}
					</Link>
				</h3>
				{item.description ? (
					<p className="content-row__body">{item.description}</p>
				) : null}
				<div className="content-row__meta">
					<span className="row row--tight">
						<Clock size={13} weight="regular" aria-hidden="true" />
						{due === null ? (
							<span>No deadline</span>
						) : (
							<span className={overdue ? "num overdue" : "num"}>
								due {formatDateTime(item.due_at ?? "")}
							</span>
						)}
					</span>
					<Chip tone="muted">{item.max_points} pts</Chip>
					<Chip tone="muted">
						{item.submission_type === "both"
							? "text or file"
							: item.submission_type === "file"
								? "file"
								: "text"}
					</Chip>
					{overdue && item.allow_late ? (
						<Badge tone="warning">late accepted</Badge>
					) : null}
					{!item.allow_late && overdue ? (
						<Badge tone="error">closed</Badge>
					) : null}
				</div>
			</div>
			{canManage ? (
				<div className="content-row__actions">
					<IconButton
						label={`Edit ${item.title}`}
						icon={
							<PencilSimple size={14} weight="regular" aria-hidden="true" />
						}
						onClick={onEdit}
					/>
					<IconButton
						label={`Delete ${item.title}`}
						icon={<Trash size={14} weight="regular" aria-hidden="true" />}
						tone="danger"
						onClick={onDelete}
					/>
				</div>
			) : null}
		</article>
	);
}

function QuizRow({
	quiz,
	canManage,
	onEdit,
	onDelete,
}: {
	quiz: Quiz;
	canManage: boolean;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<article className="content-row">
			<div className="content-row__main">
				<h3 className="content-row__title">{quiz.title}</h3>
				{quiz.description ? (
					<p className="content-row__body">{quiz.description}</p>
				) : null}
				<div className="content-row__meta">
					<span className="row row--tight">
						<Clock size={13} weight="regular" aria-hidden="true" />
						<span className="num">{quiz.time_limit_minutes}</span> min
					</span>
					<span className="row row--tight">
						<ListChecks size={13} weight="regular" aria-hidden="true" />
						<span className="num">{quiz.question_count}</span>{" "}
						{quiz.question_count === 1 ? "question" : "questions"}
					</span>
				</div>
			</div>
			{canManage ? (
				<div className="content-row__actions">
					<IconButton
						label={`Edit ${quiz.title}`}
						icon={
							<PencilSimple size={14} weight="regular" aria-hidden="true" />
						}
						onClick={onEdit}
					/>
					<IconButton
						label={`Delete ${quiz.title}`}
						icon={<Trash size={14} weight="regular" aria-hidden="true" />}
						tone="danger"
						onClick={onDelete}
					/>
				</div>
			) : null}
		</article>
	);
}

/**
 * A flashcard set drawn as a deck: a card face with two more peeking out
 * behind it (fewer for small sets). The face shows the first card's prompt;
 * clicking it opens the study view.
 */
function FlashcardSetTile({
	set,
	canManage,
	onStudy,
	onEdit,
	onDelete,
}: {
	set: FlashcardSet;
	canManage: boolean;
	onStudy: () => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const count = set.cards.length;
	const depth = Math.min(count - 1, 2);
	const preview = set.cards[0]?.front;
	return (
		<li className={`deck deck--depth-${Math.max(depth, 0)}`}>
			<div className="deck__face">
				<button
					type="button"
					className="deck__open"
					onClick={onStudy}
					disabled={count === 0}
					aria-label={`Study ${set.title}, ${count} ${count === 1 ? "card" : "cards"}`}
				/>
				<div className="deck__top">
					<span className="deck__count num">
						<Cards size={13} weight="regular" aria-hidden="true" />
						{count} {count === 1 ? "card" : "cards"}
					</span>
					{canManage ? (
						<span className="deck__tools">
							<IconButton
								label={`Edit ${set.title}`}
								icon={
									<PencilSimple size={14} weight="regular" aria-hidden="true" />
								}
								onClick={onEdit}
							/>
							<IconButton
								label={`Delete ${set.title}`}
								icon={<Trash size={14} weight="regular" aria-hidden="true" />}
								tone="danger"
								onClick={onDelete}
							/>
						</span>
					) : null}
				</div>
				{preview ? (
					<p className="deck__preview">{preview}</p>
				) : (
					<p className="deck__preview deck__preview--empty">No cards yet</p>
				)}
				<div className="deck__bottom">
					<h3 className="deck__title">{set.title}</h3>
					{set.description ? (
						<p className="deck__description">{set.description}</p>
					) : null}
					<span className="deck__study" aria-hidden="true">
						<Play size={11} weight="fill" />
						Study
					</span>
				</div>
			</div>
		</li>
	);
}

function DetailContent({ subjectId }: { subjectId: string }) {
	const subject = useSubject(subjectId);
	const { session, hasPermission } = useAuth();
	const canManageSubject = hasPermission("subjects.manage");
	const { deleteSubject, deleteSession, deleteQuiz, deleteFlashcardSet } =
		useSubjectMutations(subjectId);
	const { remove: deleteAssignment } = useAssignmentMutations(subjectId);
	const weeks = useWeeks(subjectId);
	// The Participants tab label carries the roster size, so the page reads the
	// roster as well; the panel itself shares this cached query. Students never
	// get the tab, so they never ask for it.
	const roster = useSubjectEnrollments(
		canManageSubject ? subjectId : undefined,
	);
	const { remove: deleteWeek } = useWeekMutations(subjectId);
	// The open tab lives in the URL (`?tab=quizzes`) so links can land on it and
	// refresh keeps it.
	const navigate = useNavigate();
	const requestedTab: Tab = subjectDetailRoute.useSearch().tab ?? "weeks";
	// An old link to a staff-only tab falls back to the first tab rather than
	// opening an empty panel.
	const tab: Tab =
		requestedTab === "participants" && !canManageSubject
			? "weeks"
			: requestedTab;
	const setTab = (next: Tab) =>
		void navigate({
			to: "/subjects/$subjectId",
			params: { subjectId },
			search: next === "weeks" ? {} : { tab: next },
			replace: true,
		});
	const [dialog, setDialog] = useState<DialogState>(null);

	const isStudent = session?.user.role === "STUDENT";
	const studentGrades = useStudentGrades(
		isStudent ? session?.user.id : undefined,
	);
	const myGrade = studentGrades.data?.find(
		(grade) => grade.subject_id === subjectId,
	);

	const close = () => setDialog(null);

	const subjectName = subject.data?.name;
	useEffect(() => {
		if (!subjectName) return;
		setChatMaterial({ title: subjectName, kind: "subject" });
		return () => setChatMaterial(null);
	}, [subjectName]);

	if (subject.isPending) {
		return (
			<Card>
				<SkeletonStack rows={7} />
			</Card>
		);
	}

	if (subject.isError) {
		// The catalogue is scoped server-side: a student who opens a subject they
		// are not enrolled in gets 403, not an empty page. That is a normal state
		// for them, not a failure, so it gets its own placid screen.
		const notEnrolled =
			subject.error instanceof ApiError && subject.error.status === 403;
		if (notEnrolled) {
			return (
				<>
					<Link to="/subjects" className="back-link">
						<CaretLeft size={13} weight="bold" aria-hidden="true" />
						All subjects
					</Link>
					<Card>
						<EmptyState
							icon={LockKey}
							title="You are not enrolled in this subject"
							description={
								isStudent
									? "Its weeks, lectures and materials are only open to the students on its roster. If you should be taking it, ask your lecturer or the student office to enrol you."
									: "This subject is outside what your account may read."
							}
							action={
								<Link to="/subjects" className="btn btn--secondary btn--sm">
									Back to my subjects
								</Link>
							}
						/>
					</Card>
				</>
			);
		}
		return (
			<>
				<Link to="/subjects" className="back-link">
					<CaretLeft size={13} weight="bold" aria-hidden="true" />
					All subjects
				</Link>
				<Card>
					<ErrorState
						title="Subject could not be loaded"
						message={errorMessage(subject.error)}
						onRetry={() => void subject.refetch()}
					/>
				</Card>
			</>
		);
	}

	const data: SubjectDetail = subject.data;
	const canManage: Record<Tab, boolean> = {
		weeks: hasPermission("subjects.manage"),
		lectures: hasPermission("lectures.manage"),
		assignments: hasPermission("assignments.manage"),
		quizzes: hasPermission("quizzes.manage"),
		flashcards: hasPermission("flashcards.manage"),
		grades: hasPermission("grades.manage"),
		forums: hasPermission("forums.moderate"),
		participants: canManageSubject,
	};

	const counts: Record<Tab, number | null> = {
		weeks: weeks.data?.weeks.length ?? null,
		lectures: data.lectures.length,
		assignments: data.assignments.length,
		quizzes: data.quizzes.length,
		flashcards: data.flashcard_sets.length,
		grades: null,
		forums: null,
		participants: roster.data?.enrolled.length ?? null,
	};

	const addLabel: Partial<Record<Tab, string>> = {
		weeks: "Add week",
		lectures: "Add lecture",
		assignments: "Add assignment",
		quizzes: "Add quiz",
		flashcards: "New flashcard set",
	};

	// A week's + opens the same dialogs as the tab toolbar, already pointed at
	// that week. Each kind has its own permission, so the menu only offers what
	// this role may actually create.
	const canAddKind: Record<WeekItemKind, boolean> = {
		lecture: canManage.lectures,
		assignment: canManage.assignments,
		quiz: canManage.quizzes,
		flashcard: canManage.flashcards,
	};

	const openAddInWeek = (week: CourseWeek | null, kind: WeekItemKind) => {
		const weekId = week?.id;
		if (kind === "lecture")
			return setDialog({ kind: "session-create", weekId });
		if (kind === "assignment")
			return setDialog({ kind: "assignment-create", weekId });
		if (kind === "quiz") return setDialog({ kind: "quiz-create", weekId });
		return setDialog({ kind: "set-create", weekId });
	};

	const openAdd = () => {
		if (tab === "weeks") return setDialog({ kind: "week-create" });
		if (tab === "lectures") return setDialog({ kind: "session-create" });
		if (tab === "assignments") return setDialog({ kind: "assignment-create" });
		if (tab === "quizzes") return setDialog({ kind: "quiz-create" });
		if (tab === "flashcards") return setDialog({ kind: "set-create" });
	};

	const emptyCopy: Record<Tab, string> = {
		weeks: "No weeks yet — plan the term week by week.",
		lectures: "No lectures yet — schedule the first one.",
		assignments: "No assignments yet — add the first one.",
		quizzes: "No quizzes yet — add the first one.",
		flashcards: "No flashcard sets yet — create the first deck.",
		grades: "No grade components yet.",
		forums: "No forum yet.",
		participants: "Nobody is enrolled yet.",
	};

	const listEmpty = counts[tab] === 0 || counts[tab] === null;
	// A new week continues the subject's own season, so the number never clashes.
	const subjectSeason = weeks.data?.season ?? "FALL";
	const nextWeekNumber =
		(weeks.data?.weeks ?? [])
			.filter((week) => week.season === subjectSeason)
			.reduce((highest, week) => Math.max(highest, week.week_number), 0) + 1;

	return (
		<>
			<Link to="/subjects" className="back-link">
				<CaretLeft size={13} weight="bold" aria-hidden="true" />
				All subjects
			</Link>

			<PageHeader
				eyebrow={
					[
						data.code,
						data.programme_name
							? `${data.programme_name}${data.year_of_study ? `, year ${data.year_of_study}` : ""}`
							: null,
					]
						.filter(Boolean)
						.join(" · ") || null
				}
				title={data.name}
				description={data.description ?? "No description for this subject."}
				actions={
					canManageSubject ? (
						<>
							<Button
								variant="secondary"
								size="sm"
								icon={
									<PencilSimple size={15} weight="regular" aria-hidden="true" />
								}
								onClick={() => setDialog({ kind: "subject-edit" })}
							>
								Edit subject
							</Button>
							<Button
								variant="ghost"
								size="sm"
								icon={<Trash size={15} weight="regular" aria-hidden="true" />}
								onClick={() => setDialog({ kind: "subject-delete" })}
							>
								Delete
							</Button>
						</>
					) : null
				}
			/>

			<dl className="subject-meta">
				<div>
					<dt>Lecturer</dt>
					<dd>{data.lecturer_name || "Unassigned"}</dd>
				</div>
				<div>
					<dt>Credits</dt>
					<dd className="num">{data.ects ? `${data.ects} ECTS` : "Not set"}</dd>
				</div>
				<div>
					<dt>Term</dt>
					<dd className="num">
						{data.semester === "SECOND" ? "Semester II" : "Semester I"}
						{data.school_year ? ` · ${data.school_year}` : ""}
					</dd>
				</div>
			</dl>

			<div className="tabs-bar">
				<div className="tabs" role="tablist" aria-label="Subject content">
					{TABS.filter(
						(entry) => entry.key !== "participants" || canManageSubject,
					).map((entry) => {
						const active = entry.key === tab;
						const count = counts[entry.key];
						return (
							<button
								key={entry.key}
								type="button"
								role="tab"
								id={`tab-${entry.key}`}
								aria-selected={active}
								aria-controls={`panel-${entry.key}`}
								className={["tab", active ? "tab--active" : ""]
									.filter(Boolean)
									.join(" ")}
								onClick={() => setTab(entry.key)}
							>
								{entry.icon}
								<span>{entry.label}</span>
								{count === null ? null : (
									<span className="tab__count num">{count}</span>
								)}
							</button>
						);
					})}
				</div>

				{canManage[tab] && addLabel[tab] ? (
					<Button
						variant="primary"
						size="sm"
						icon={<Plus size={15} weight="bold" aria-hidden="true" />}
						onClick={openAdd}
					>
						{addLabel[tab]}
					</Button>
				) : null}
			</div>

			<div
				role="tabpanel"
				id={`panel-${tab}`}
				aria-labelledby={`tab-${tab}`}
				className="tab-panel"
			>
				{tab === "participants" ? (
					<ParticipantsPanel subjectId={subjectId} subjectName={data.name} />
				) : tab === "grades" ? (
					canManage.grades ? (
						<GradebookPanel
							subjectId={subjectId}
							userId={session?.user.id ?? ""}
							canManage
							assignments={data.assignments}
						/>
					) : myGrade ? (
						<SubjectGradeView
							grade={myGrade}
							bands={studentGrades.data ? undefined : undefined}
						/>
					) : (
						<Card>
							<EmptyState
								icon={ChartBar}
								title="No grade to show yet"
								description="The lecturer has not published grade components for this subject. Your official grade stays with the exam office."
							/>
						</Card>
					)
				) : tab === "forums" ? (
					<ForumPanel
						subjectId={subjectId}
						userId={session?.user.id ?? ""}
						canModerate={hasPermission("forums.moderate")}
						canPost={hasPermission("forums.post")}
					/>
				) : (
					<>
						{canManage[tab] || tab === "weeks" ? null : (
							<p className="tab-panel__hint row row--tight">
								<LockKey size={13} weight="regular" aria-hidden="true" />
								Read only — changing this needs the <code>{tab}.manage</code>{" "}
								permission.
							</p>
						)}

						{tab === "weeks" ? (
							<WeeksPanel
								data={weeks.data}
								isPending={weeks.isPending}
								canManage={canManage.weeks}
								canAdd={canAddKind}
								onAdd={openAddInWeek}
								onEdit={(week) => setDialog({ kind: "week-edit", week })}
								onDelete={(week) => setDialog({ kind: "week-delete", week })}
							/>
						) : tab === "flashcards" && !listEmpty ? (
							<ul className="deck-grid">
								{data.flashcard_sets.map((set) => (
									<FlashcardSetTile
										key={set.id}
										set={set}
										canManage={canManage.flashcards}
										onStudy={() => setDialog({ kind: "set-study", set })}
										onEdit={() => setDialog({ kind: "set-edit", set })}
										onDelete={() => setDialog({ kind: "set-delete", set })}
									/>
								))}
							</ul>
						) : (
							<Card className="card--flush">
								{listEmpty ? (
									<EmptyState
										icon={Books}
										title={emptyCopy[tab]}
										description={
											canManage[tab]
												? undefined
												: "Your role can read this subject but not add content to it."
										}
										action={
											canManage[tab] && addLabel[tab] ? (
												<Button
													variant="secondary"
													size="sm"
													icon={
														<Plus
															size={15}
															weight="regular"
															aria-hidden="true"
														/>
													}
													onClick={openAdd}
												>
													{addLabel[tab]}
												</Button>
											) : null
										}
									/>
								) : (
									<div className="content-list">
										{tab === "lectures"
											? data.lectures.map((item) => (
													<SessionRow
														key={item.id}
														item={item}
														canManage={canManage.lectures}
														onEdit={() =>
															setDialog({ kind: "session-edit", item })
														}
														onDelete={() =>
															setDialog({ kind: "session-delete", item })
														}
													/>
												))
											: null}
										{tab === "assignments"
											? data.assignments.map((item) => (
													<AssignmentRow
														key={item.id}
														item={item}
														canManage={canManage.assignments}
														onEdit={() =>
															setDialog({ kind: "assignment-edit", item })
														}
														onDelete={() =>
															setDialog({ kind: "assignment-delete", item })
														}
													/>
												))
											: null}
										{tab === "quizzes"
											? data.quizzes.map((quiz) => (
													<QuizRow
														key={quiz.id}
														quiz={quiz}
														canManage={canManage.quizzes}
														onEdit={() =>
															setDialog({ kind: "quiz-edit", quiz })
														}
														onDelete={() =>
															setDialog({ kind: "quiz-delete", quiz })
														}
													/>
												))
											: null}
									</div>
								)}
							</Card>
						)}
					</>
				)}
			</div>

			{dialog?.kind === "subject-edit" ? (
				<SubjectFormDialog subject={data} onClose={close} />
			) : null}

			{dialog?.kind === "subject-delete" ? (
				<ConfirmDialog
					title={`Delete ${data.name}?`}
					description="The subject and everything inside it is removed."
					consequences={
						<>
							This deletes <strong>{data.counts.lectures}</strong> lectures,{" "}
							<strong>{data.counts.assignments}</strong> assignments,{" "}
							<strong>{data.counts.quizzes}</strong> quizzes and{" "}
							<strong>{data.counts.flashcard_sets}</strong> flashcard sets.
						</>
					}
					confirmLabel="Delete subject"
					successMessage="Subject deleted"
					onConfirm={async () => {
						await deleteSubject.mutateAsync(data.id);
						void subject.refetch();
					}}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "session-create" ? (
				<SessionFormDialog
					kind="lectures"
					subjectId={subjectId}
					weekId={dialog.weekId}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "session-edit" ? (
				<SessionFormDialog
					kind="lectures"
					subjectId={subjectId}
					item={dialog.item}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "session-delete" ? (
				<ConfirmDialog
					title={`Delete ${dialog.item.title}?`}
					description="The lecture is removed from this subject."
					confirmLabel="Delete lecture"
					successMessage="Lecture deleted"
					onConfirm={() =>
						deleteSession.mutateAsync({ kind: "lectures", id: dialog.item.id })
					}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "assignment-create" ? (
				<AssignmentFormDialog
					subjectId={subjectId}
					weekId={dialog.weekId}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "assignment-edit" ? (
				<AssignmentFormDialog
					subjectId={subjectId}
					assignment={dialog.item}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "assignment-delete" ? (
				<ConfirmDialog
					title={`Delete ${dialog.item.title}?`}
					description="The assignment and every submission attached to it is removed."
					confirmLabel="Delete assignment"
					successMessage="Assignment deleted"
					onConfirm={() => deleteAssignment.mutateAsync(dialog.item.id)}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "quiz-create" ? (
				<QuizFormDialog
					subjectId={subjectId}
					weekId={dialog.weekId}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "quiz-edit" ? (
				<QuizFormDialog
					subjectId={subjectId}
					quiz={dialog.quiz}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "quiz-delete" ? (
				<ConfirmDialog
					title={`Delete ${dialog.quiz.title}?`}
					description="The quiz and its questions are removed."
					confirmLabel="Delete quiz"
					successMessage="Quiz deleted"
					onConfirm={() => deleteQuiz.mutateAsync(dialog.quiz.id)}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "set-create" ? (
				<FlashcardSetFormDialog
					subjectId={subjectId}
					weekId={dialog.weekId}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "set-edit" ? (
				<FlashcardSetFormDialog
					subjectId={subjectId}
					set={dialog.set}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "set-study" ? (
				<FlashcardStudyDialog set={dialog.set} onClose={close} />
			) : null}

			{dialog?.kind === "week-create" ? (
				<WeekFormDialog
					subjectId={subjectId}
					season={subjectSeason}
					nextNumber={nextWeekNumber}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "week-edit" ? (
				<WeekFormDialog
					subjectId={subjectId}
					season={dialog.week.season}
					week={dialog.week}
					nextNumber={nextWeekNumber}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "week-delete" ? (
				<ConfirmDialog
					title={`Delete week ${dialog.week.week_number}?`}
					description="The week is removed from the term; its content stays on the subject."
					consequences={
						<>
							The <strong>{dialog.week.items.length}</strong> pieces of content
							in this week are not deleted: they become unscheduled and can be
							filed into another week.
						</>
					}
					confirmLabel="Delete week"
					successMessage="Week deleted"
					onConfirm={() => deleteWeek.mutateAsync(dialog.week.id)}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "set-delete" ? (
				<ConfirmDialog
					title={`Delete ${dialog.set.title}?`}
					description="The set is removed from this subject."
					consequences={
						<>
							All <strong>{dialog.set.cards.length}</strong> cards in this set
							are deleted. This cannot be undone.
						</>
					}
					confirmLabel="Delete set"
					successMessage="Flashcard set deleted"
					onConfirm={() => deleteFlashcardSet.mutateAsync(dialog.set.id)}
					onClose={close}
				/>
			) : null}
		</>
	);
}

/** Content that lives on the subject page; any one of them opens the page. */
const SUBJECT_CONTENT_PERMISSIONS = [
	"lectures.view",
	"assignments.view",
	"quizzes.view",
	"flashcards.view",
	"forums.view",
	"grades.view",
];

function SubjectDetailPage() {
	const { subjectId } = subjectDetailRoute.useParams();
	const { hasPermission } = useAuth();
	// Students have no Subjects module, but their lectures, quizzes and cards
	// live on this page, so holding any of those is enough to open it.
	if (SUBJECT_CONTENT_PERMISSIONS.some((key) => hasPermission(key))) {
		return <DetailContent subjectId={subjectId} />;
	}
	return (
		<AccessGate
			moduleKey="subjects"
			permissionKey="subjects.view"
			label="Subjects"
		>
			<DetailContent subjectId={subjectId} />
		</AccessGate>
	);
}

export const subjectDetailRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/subjects/$subjectId",
	validateSearch: (search: Record<string, unknown>): { tab?: Tab } =>
		TABS.some((entry) => entry.key === search.tab)
			? { tab: search.tab as Tab }
			: {},
	component: SubjectDetailPage,
});
