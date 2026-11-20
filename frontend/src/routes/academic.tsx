import {
	ArrowLeft,
	BookOpen,
	Buildings,
	CaretRight,
	DotsThree,
	GraduationCap,
	LockKey,
	PencilSimple,
	Plus,
	Student,
	Trash,
	TreeStructure,
} from "@phosphor-icons/react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";
import {
	type AdmissionStatus,
	type Department,
	errorMessage,
	type Faculty,
	type Programme,
	type ProgrammeDetail,
	type ProgrammeLevel,
	type ProgrammeRow,
	type ProgrammeStudent,
} from "../api";
import { useAuth } from "../auth";
import { AdmissionFormDialog } from "../components/academic/AdmissionFormDialog";
import { CourseAssignDialog } from "../components/academic/CourseAssignDialog";
import { DepartmentFormDialog } from "../components/academic/DepartmentFormDialog";
import { FacultyFormDialog } from "../components/academic/FacultyFormDialog";
import { ProgrammeFormDialog } from "../components/academic/ProgrammeFormDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ModuleGate } from "../components/ModuleGate";
import {
	Badge,
	type BadgeTone,
	Button,
	Card,
	CardBody,
	CardHeader,
	Chip,
	EmptyState,
	ErrorState,
	IconButton,
	InlineNote,
	Menu,
	PageHeader,
	SegmentedFilter,
	SkeletonStack,
	Table,
	Td,
	Th,
} from "../components/ui";
import {
	useAcademicMutations,
	useAcademicTree,
	useProgramme,
} from "../queries";
import { toastApiError } from "../toast";
import { appLayoutRoute } from "./app-layout";

type AcademicView = "cards" | "chart";
type AcademicSearch = { programme?: string; view?: AcademicView };

function parseAcademicSearch(search: Record<string, unknown>): AcademicSearch {
	const result: AcademicSearch = {};
	if (typeof search.programme === "string" && search.programme)
		result.programme = search.programme;
	if (search.view === "cards") result.view = "cards";
	return result;
}

type DialogState =
	| { kind: "faculty-create" }
	| { kind: "faculty-edit"; faculty: Faculty }
	| { kind: "faculty-delete"; faculty: Faculty }
	| { kind: "department-create"; faculty: Faculty }
	| { kind: "department-edit"; department: Department }
	| { kind: "department-delete"; department: Department }
	| { kind: "programme-create"; department: Department }
	| {
			kind: "programme-edit";
			programme: ProgrammeRow & { description?: string };
	  }
	| { kind: "programme-delete"; programme: ProgrammeRow }
	| { kind: "admission-create"; programme: Programme }
	| {
			kind: "admission-edit";
			programme: Programme;
			admission: ProgrammeStudent;
	  }
	| {
			kind: "admission-remove";
			programme: Programme;
			admission: ProgrammeStudent;
	  }
	| { kind: "course-assign"; programme: Programme }
	| null;

const LEVEL_LABEL: Record<ProgrammeLevel, string> = {
	BACHELOR: "Bachelor",
	MASTER: "Master",
	DOCTORATE: "Doctorate",
};

const STATUS_LABEL: Record<AdmissionStatus, string> = {
	ACTIVE: "Active",
	GRADUATED: "Graduated",
	SUSPENDED: "Suspended",
	WITHDRAWN: "Withdrawn",
};

const STATUS_TONE: Record<AdmissionStatus, BadgeTone> = {
	ACTIVE: "success",
	GRADUATED: "primary",
	SUSPENDED: "warning",
	WITHDRAWN: "outline",
};

const plural = (count: number, one: string, many: string) =>
	`${count} ${count === 1 ? one : many}`;

function programmeMeta(programme: ProgrammeRow): string {
	const parts = [
		LEVEL_LABEL[programme.level],
		plural(programme.duration_years, "year", "years"),
	];
	if (programme.total_ects) parts.push(`${programme.total_ects} ECTS`);
	parts.push(plural(programme.courses, "course", "courses"));
	parts.push(plural(programme.students, "student", "students"));
	return parts.join(" · ");
}

/* ---------- the tree ---------- */

function ProgrammeTile({ programme }: { programme: ProgrammeRow }) {
	return (
		<Link
			to="/academic"
			search={{ programme: programme.id }}
			className="programme-tile"
		>
			<span className="programme-tile__text">
				<span className="programme-tile__head">
					<span className="programme-tile__name">{programme.name}</span>
					{programme.code ? <Chip tone="muted">{programme.code}</Chip> : null}
				</span>
				<span className="programme-tile__meta num">
					{programmeMeta(programme)}
				</span>
			</span>
			<CaretRight
				size={14}
				weight="bold"
				aria-hidden="true"
				className="programme-tile__caret"
			/>
		</Link>
	);
}

function DepartmentBlock({
	department,
	canManage,
	onDialog,
}: {
	department: Department;
	canManage: boolean;
	onDialog: (dialog: DialogState) => void;
}) {
	return (
		<li className="academic-dept">
			<div className="academic-dept__head">
				<Buildings
					size={15}
					weight="regular"
					aria-hidden="true"
					className="academic-dept__icon"
				/>
				<span className="academic-dept__name">{department.name}</span>
				{department.code ? <Chip tone="muted">{department.code}</Chip> : null}
				<span className="academic-dept__count num">
					{plural(department.students, "student", "students")}
				</span>
				{canManage ? (
					<div className="academic-dept__actions">
						<IconButton
							label={`Add programme to ${department.name}`}
							icon={<Plus size={14} weight="bold" aria-hidden="true" />}
							onClick={() => onDialog({ kind: "programme-create", department })}
						/>
						<Menu
							aria-label={`Manage ${department.name}`}
							trigger={<DotsThree size={16} weight="bold" aria-hidden="true" />}
							triggerClassName="icon-btn"
							items={[
								{
									key: "edit",
									label: "Edit department",
									icon: (
										<PencilSimple
											size={14}
											weight="regular"
											aria-hidden="true"
										/>
									),
									onSelect: () =>
										onDialog({ kind: "department-edit", department }),
								},
								{
									key: "delete",
									label: "Delete department",
									icon: <Trash size={14} weight="regular" aria-hidden="true" />,
									destructive: true,
									onSelect: () =>
										onDialog({ kind: "department-delete", department }),
								},
							]}
						/>
					</div>
				) : null}
			</div>

			{department.programmes.length === 0 ? (
				canManage ? (
					<Button
						variant="ghost"
						size="sm"
						className="academic-add-tile"
						icon={<Plus size={13} weight="bold" aria-hidden="true" />}
						onClick={() => onDialog({ kind: "programme-create", department })}
					>
						Add the first programme
					</Button>
				) : (
					<p className="academic-dept__empty">No programmes yet.</p>
				)
			) : (
				<ul className="programme-list">
					{department.programmes.map((programme) => (
						<li key={programme.id}>
							<ProgrammeTile programme={programme} />
						</li>
					))}
				</ul>
			)}
		</li>
	);
}

function FacultyCard({
	faculty,
	canManage,
	onDialog,
}: {
	faculty: Faculty;
	canManage: boolean;
	onDialog: (dialog: DialogState) => void;
}) {
	const programmes = faculty.departments.reduce(
		(total, department) => total + department.programmes.length,
		0,
	);

	return (
		<Card className="faculty-card">
			<CardHeader
				icon={
					<span className="card__mark" aria-hidden="true">
						<TreeStructure size={15} weight="regular" />
					</span>
				}
				title={faculty.name}
				hint={faculty.code ? <Chip tone="muted">{faculty.code}</Chip> : null}
				actions={
					canManage ? (
						<>
							<Button
								size="sm"
								icon={<Plus size={13} weight="bold" aria-hidden="true" />}
								onClick={() => onDialog({ kind: "department-create", faculty })}
							>
								Department
							</Button>
							<Menu
								aria-label={`Manage ${faculty.name}`}
								trigger={
									<DotsThree size={16} weight="bold" aria-hidden="true" />
								}
								triggerClassName="icon-btn"
								items={[
									{
										key: "edit",
										label: "Edit faculty",
										icon: (
											<PencilSimple
												size={14}
												weight="regular"
												aria-hidden="true"
											/>
										),
										onSelect: () => onDialog({ kind: "faculty-edit", faculty }),
									},
									{
										key: "delete",
										label: "Delete faculty",
										icon: (
											<Trash size={14} weight="regular" aria-hidden="true" />
										),
										destructive: true,
										onSelect: () =>
											onDialog({ kind: "faculty-delete", faculty }),
									},
								]}
							/>
						</>
					) : null
				}
			/>
			<CardBody className="faculty-card__body">
				<p className="academic-faculty__meta num">
					{plural(faculty.departments.length, "department", "departments")} ·{" "}
					{plural(programmes, "programme", "programmes")} ·{" "}
					{plural(faculty.students, "student", "students")}
				</p>
				{faculty.departments.length === 0 ? (
					canManage ? (
						<Button
							variant="ghost"
							size="sm"
							className="academic-add-tile"
							icon={<Plus size={13} weight="bold" aria-hidden="true" />}
							onClick={() => onDialog({ kind: "department-create", faculty })}
						>
							Add the first department
						</Button>
					) : (
						<p className="academic-dept__empty">No departments yet.</p>
					)
				) : (
					<ul className="academic-depts">
						{faculty.departments.map((department) => (
							<DepartmentBlock
								key={department.id}
								department={department}
								canManage={canManage}
								onDialog={onDialog}
							/>
						))}
					</ul>
				)}
			</CardBody>
		</Card>
	);
}

/* ---------- organigram ---------- */

/**
 * The whole tree at its natural width, inside a horizontally scrollable card.
 * A fitted chart was measured once and then scaled with a transform, which left
 * the widest row (and the root "Institution" node) clipped as soon as the
 * webfont settled and the boxes grew past that first measurement. Scrolling
 * instead of scaling also keeps every label at full size and survives browser
 * zoom, and the `marginInline` on a max-content list centres a tree that is
 * narrower than the card.
 */
function Organigram({ faculties }: { faculties: Faculty[] }) {
	const students = faculties.reduce((total, f) => total + f.students, 0);
	const scrollRef = useRef<HTMLDivElement>(null);

	// A tree wider than the card opens with the root node in the middle of the
	// view, so "Institution" is on screen instead of sitting off to the right;
	// both ends stay a scroll away. Narrow trees are centred by CSS and this
	// leaves their scroll position alone.
	useLayoutEffect(() => {
		const scroll = scrollRef.current;
		const root = scroll?.querySelector<HTMLElement>(".org-node--root");
		if (!scroll || !root) return;
		const overflow = scroll.scrollWidth - scroll.clientWidth;
		if (overflow <= 0) return;
		const box = root.getBoundingClientRect();
		const view = scroll.getBoundingClientRect();
		const centred = box.left - view.left - (view.width - box.width) / 2;
		scroll.scrollLeft = Math.max(
			0,
			Math.min(scroll.scrollLeft + centred, overflow),
		);
	}, []);

	return (
		<Card className="org-card">
			<div
				ref={scrollRef}
				className="org-scroll"
				role="group"
				aria-label="Academic structure: institution, faculties, departments and programmes"
				// The same thin scrollbar the module list uses, so the sideways
				// scroll reads as part of the app rather than a cut-off card.
				style={{ scrollbarWidth: "thin" }}
			>
				<ul className="org" style={{ marginInline: "auto" }}>
					<li>
						<div className="org-node org-node--root">
							<span className="org-node__icon" aria-hidden="true">
								<TreeStructure size={16} weight="regular" />
							</span>
							<span className="org-node__text">
								<span className="org-node__name">Institution</span>
								<span className="org-node__meta num">
									{plural(faculties.length, "faculty", "faculties")} ·{" "}
									{plural(students, "student", "students")}
								</span>
							</span>
						</div>
						<ul>
							{faculties.map((faculty) => (
								<li key={faculty.id}>
									<div className="org-node org-node--faculty">
										<span className="org-node__icon" aria-hidden="true">
											<TreeStructure size={14} weight="regular" />
										</span>
										<span className="org-node__text">
											<span className="org-node__name">
												{faculty.name}
												{faculty.code ? (
													<span className="org-node__code">{faculty.code}</span>
												) : null}
											</span>
											<span className="org-node__meta num">
												{plural(faculty.students, "student", "students")}
											</span>
										</span>
									</div>
									{faculty.departments.length > 0 ? (
										<ul>
											{faculty.departments.map((department) => (
												<li key={department.id}>
													<div className="org-node org-node--dept">
														<span className="org-node__icon" aria-hidden="true">
															<Buildings size={14} weight="regular" />
														</span>
														<span className="org-node__text">
															<span className="org-node__name">
																{department.name}
																{department.code ? (
																	<span className="org-node__code">
																		{department.code}
																	</span>
																) : null}
															</span>
															<span className="org-node__meta num">
																{plural(
																	department.students,
																	"student",
																	"students",
																)}
															</span>
														</span>
													</div>
													{department.programmes.length > 0 ? (
														<ol className="org-leaves">
															{department.programmes.map((programme) => (
																<li key={programme.id}>
																	<Link
																		to="/academic"
																		search={{ programme: programme.id }}
																		className="org-node org-node--programme"
																	>
																		<span className="org-node__text">
																			<span className="org-node__name">
																				{programme.name}
																			</span>
																			<span className="org-node__meta num">
																				{programme.code
																					? `${programme.code} · `
																					: ""}
																				{plural(
																					programme.students,
																					"student",
																					"students",
																				)}
																			</span>
																		</span>
																	</Link>
																</li>
															))}
														</ol>
													) : null}
												</li>
											))}
										</ul>
									) : null}
								</li>
							))}
						</ul>
					</li>
				</ul>
			</div>
		</Card>
	);
}

/* ---------- one programme ---------- */

function ProgrammePanel({
	detail,
	canManage,
	onDialog,
}: {
	detail: ProgrammeDetail;
	canManage: boolean;
	onDialog: (dialog: DialogState) => void;
}) {
	const { programme, courses, students } = detail;
	const { unassignCourse } = useAcademicMutations(programme.id);

	const removeCourse = async (subjectId: string, name: string) => {
		try {
			await unassignCourse.mutateAsync({ id: programme.id, subjectId });
		} catch (error) {
			toastApiError(error, `${name} could not be removed from the programme`);
		}
	};

	return (
		<div className="stack">
			<Card className="programme-card">
				<CardHeader
					icon={
						<span className="card__mark" aria-hidden="true">
							<GraduationCap size={15} weight="regular" />
						</span>
					}
					title={programme.name}
					hint={
						<span className="academic-programme__hint">
							{programme.code ? (
								<Chip tone="muted">{programme.code}</Chip>
							) : null}
							<span className="academic-programme__path">
								{programme.faculty_name} · {programme.department_name}
							</span>
						</span>
					}
					actions={
						canManage ? (
							<Menu
								aria-label={`Manage ${programme.name}`}
								trigger={
									<DotsThree size={16} weight="bold" aria-hidden="true" />
								}
								triggerClassName="icon-btn"
								items={[
									{
										key: "edit",
										label: "Edit programme",
										icon: (
											<PencilSimple
												size={14}
												weight="regular"
												aria-hidden="true"
											/>
										),
										onSelect: () =>
											onDialog({ kind: "programme-edit", programme }),
									},
									{
										key: "delete",
										label: "Delete programme",
										icon: (
											<Trash size={14} weight="regular" aria-hidden="true" />
										),
										destructive: true,
										onSelect: () =>
											onDialog({ kind: "programme-delete", programme }),
									},
								]}
							/>
						) : null
					}
				/>
				<CardBody>
					<div className="row academic-programme__facts">
						<Badge tone="outline">{LEVEL_LABEL[programme.level]}</Badge>
						<span className="num">
							{plural(programme.duration_years, "year", "years")}
						</span>
						{programme.total_ects ? (
							<span className="num">{programme.total_ects} ECTS</span>
						) : null}
					</div>
					{programme.description ? (
						<p className="academic-programme__description">
							{programme.description}
						</p>
					) : null}
				</CardBody>
			</Card>

			<Card className="card--flush">
				<CardHeader
					icon={
						<BookOpen
							size={17}
							weight="regular"
							aria-hidden="true"
							className="card__icon"
						/>
					}
					title="Curriculum"
					hint={
						<span className="num">
							{plural(courses.length, "course", "courses")}
						</span>
					}
					actions={
						canManage ? (
							<Button
								size="sm"
								icon={<Plus size={14} weight="bold" aria-hidden="true" />}
								onClick={() => onDialog({ kind: "course-assign", programme })}
							>
								Add course
							</Button>
						) : null
					}
				/>
				{courses.length === 0 ? (
					<CardBody>
						<EmptyState
							icon={BookOpen}
							title="No courses on this programme"
							description={
								canManage
									? "Add a course to build the curriculum this programme teaches."
									: "Courses appear here once an administrator adds them."
							}
							action={
								canManage ? (
									<Button
										variant="primary"
										size="sm"
										icon={<Plus size={15} weight="bold" aria-hidden="true" />}
										onClick={() =>
											onDialog({ kind: "course-assign", programme })
										}
									>
										Add course
									</Button>
								) : null
							}
						/>
					</CardBody>
				) : (
					<Table caption={`Courses of ${programme.name}`}>
						<thead>
							<tr>
								<Th>Year</Th>
								<Th>Course</Th>
								<Th>Lecturer</Th>
								<Th align="right">ECTS</Th>
								<Th>Semester</Th>
								<Th>School year</Th>
								{canManage ? <Th align="right">Remove</Th> : null}
							</tr>
						</thead>
						<tbody>
							{courses.map((course) => (
								<tr key={course.id}>
									<Td>
										<span className="num">{course.year_of_study || "—"}</span>
									</Td>
									<Td>
										<span className="table__primary">{course.name}</span>
										{course.code ? (
											<span className="table__secondary num">
												{course.code}
											</span>
										) : null}
									</Td>
									<Td>{course.lecturer_name || "Unassigned"}</Td>
									<Td align="right">
										<span className="table__num-cell num">
											{course.ects || "—"}
										</span>
									</Td>
									<Td>{course.semester === "SECOND" ? "Second" : "First"}</Td>
									<Td>{course.school_year || "—"}</Td>
									{canManage ? (
										<Td align="right">
											<IconButton
												label={`Remove ${course.name} from ${programme.name}`}
												icon={
													<Trash
														size={14}
														weight="regular"
														aria-hidden="true"
													/>
												}
												tone="danger"
												onClick={() =>
													void removeCourse(course.id, course.name)
												}
											/>
										</Td>
									) : null}
								</tr>
							))}
						</tbody>
					</Table>
				)}
			</Card>

			<Card className="card--flush">
				<CardHeader
					icon={
						<Student
							size={17}
							weight="regular"
							aria-hidden="true"
							className="card__icon"
						/>
					}
					title="Students"
					hint={
						<span className="num">
							{plural(students.length, "admission", "admissions")}
						</span>
					}
					actions={
						canManage ? (
							<Button
								size="sm"
								icon={<Plus size={14} weight="bold" aria-hidden="true" />}
								onClick={() =>
									onDialog({ kind: "admission-create", programme })
								}
							>
								Admit student
							</Button>
						) : null
					}
				/>
				{students.length === 0 ? (
					<CardBody>
						<EmptyState
							icon={Student}
							title="No students on this programme"
							description={
								canManage
									? "Admit a student and they will be listed here with their year of study."
									: "Students appear here once an administrator admits them."
							}
							action={
								canManage ? (
									<Button
										variant="primary"
										size="sm"
										icon={<Plus size={15} weight="bold" aria-hidden="true" />}
										onClick={() =>
											onDialog({ kind: "admission-create", programme })
										}
									>
										Admit student
									</Button>
								) : null
							}
						/>
					</CardBody>
				) : (
					<Table caption={`Students admitted to ${programme.name}`}>
						<thead>
							<tr>
								<Th>Student</Th>
								<Th>Email</Th>
								<Th align="right">Year</Th>
								<Th>Admitted</Th>
								<Th>Status</Th>
								{canManage ? <Th align="right">Actions</Th> : null}
							</tr>
						</thead>
						<tbody>
							{students.map((admission) => (
								<tr key={admission.enrollment_id}>
									<Td>
										<span className="table__primary">{admission.name}</span>
									</Td>
									<Td>
										<span className="table__secondary">{admission.email}</span>
									</Td>
									<Td align="right">
										<span className="table__num-cell num">
											{admission.year_of_study}
										</span>
									</Td>
									<Td>{admission.school_year || "—"}</Td>
									<Td>
										<Badge tone={STATUS_TONE[admission.status]}>
											{STATUS_LABEL[admission.status]}
										</Badge>
									</Td>
									{canManage ? (
										<Td align="right">
											<div className="table__inline">
												<IconButton
													label={`Edit admission of ${admission.name}`}
													icon={
														<PencilSimple
															size={14}
															weight="regular"
															aria-hidden="true"
														/>
													}
													onClick={() =>
														onDialog({
															kind: "admission-edit",
															programme,
															admission,
														})
													}
												/>
												<IconButton
													label={`Remove ${admission.name} from ${programme.name}`}
													icon={
														<Trash
															size={14}
															weight="regular"
															aria-hidden="true"
														/>
													}
													tone="danger"
													onClick={() =>
														onDialog({
															kind: "admission-remove",
															programme,
															admission,
														})
													}
												/>
											</div>
										</Td>
									) : null}
								</tr>
							))}
						</tbody>
					</Table>
				)}
			</Card>
		</div>
	);
}

/* ---------- page ---------- */

function AcademicContent() {
	const tree = useAcademicTree();
	const { hasPermission } = useAuth();
	const canManage = hasPermission("academic.manage");
	const search = academicRoute.useSearch();
	const navigate = useNavigate();
	const { deleteFaculty, deleteDepartment, deleteProgramme, removeAdmission } =
		useAcademicMutations(search.programme);
	const [dialog, setDialog] = useState<DialogState>(null);

	const faculties = tree.data?.faculties ?? [];
	const programmes = faculties.flatMap((faculty) =>
		faculty.departments.flatMap((department) => department.programmes),
	);
	const departments = faculties.reduce(
		(total, faculty) => total + faculty.departments.length,
		0,
	);
	const students = faculties.reduce(
		(total, faculty) => total + faculty.students,
		0,
	);
	// Programme forms move a programme between departments, so both the create
	// and the edit dialog need the same flattened list.
	const departmentOptions = faculties.flatMap((faculty) =>
		faculty.departments.map((department) => ({
			id: department.id,
			name: department.name,
			facultyName: faculty.name,
		})),
	);
	// A stale link (deleted programme) falls back to the tree.
	const selected = programmes.find(
		(programme) => programme.id === search.programme,
	);
	const detail = useProgramme(selected?.id);

	const view: AcademicView = search.view ?? "chart";
	const setView = (next: AcademicView) =>
		void navigate({
			to: "/academic",
			search: next === "cards" ? { view: "cards" } : {},
			replace: true,
		});
	const clearSelection = () =>
		void navigate({
			to: "/academic",
			search: search.view ? { view: search.view } : {},
		});
	const close = () => setDialog(null);

	return (
		<>
			{selected ? (
				<button type="button" className="back-link" onClick={clearSelection}>
					<ArrowLeft size={14} weight="bold" aria-hidden="true" />
					All programmes
				</button>
			) : null}

			<PageHeader
				title={selected?.name ?? "Academic structure"}
				description={
					selected
						? "The curriculum this programme teaches and the students admitted to it."
						: "Faculties hold departments, departments run programmes, and every student belongs to one programme."
				}
				actions={
					!canManage ? (
						<Badge
							tone="outline"
							icon={<LockKey size={12} weight="regular" aria-hidden="true" />}
						>
							View only
						</Badge>
					) : selected ? null : (
						<Button
							variant="primary"
							size="sm"
							icon={<Plus size={15} weight="bold" aria-hidden="true" />}
							onClick={() => setDialog({ kind: "faculty-create" })}
						>
							Add faculty
						</Button>
					)
				}
			/>

			{!canManage ? (
				<Card>
					<InlineNote>
						Your role can view the academic structure but not change it. Adding
						faculties, programmes and admissions needs the{" "}
						<code>academic.manage</code> permission.
					</InlineNote>
				</Card>
			) : null}

			{tree.data &&
			(tree.data.unassigned_courses > 0 || tree.data.unplaced_students > 0) ? (
				<Card>
					<InlineNote>
						{tree.data.unassigned_courses > 0
							? `${plural(tree.data.unassigned_courses, "course is", "courses are")} not on a programme yet.`
							: null}{" "}
						{tree.data.unplaced_students > 0
							? `${plural(tree.data.unplaced_students, "student has", "students have")} no active admission.`
							: null}
					</InlineNote>
				</Card>
			) : null}

			{tree.isPending ? (
				<div className="stack">
					<Card>
						<SkeletonStack rows={4} />
					</Card>
					<Card>
						<SkeletonStack rows={3} />
					</Card>
				</div>
			) : tree.isError ? (
				<Card>
					<ErrorState
						title="The academic structure could not be loaded"
						message={errorMessage(tree.error)}
						onRetry={() => void tree.refetch()}
					/>
				</Card>
			) : selected ? (
				detail.data ? (
					<ProgrammePanel
						detail={detail.data}
						canManage={canManage}
						onDialog={setDialog}
					/>
				) : detail.isError ? (
					<Card>
						<ErrorState
							title="The programme could not be loaded"
							message={errorMessage(detail.error)}
							onRetry={() => void detail.refetch()}
						/>
					</Card>
				) : (
					<Card>
						<SkeletonStack rows={5} />
					</Card>
				)
			) : faculties.length === 0 ? (
				<Card>
					<EmptyState
						icon={TreeStructure}
						title="No faculties yet"
						description={
							canManage
								? "Start with a faculty, add its departments, then the programmes students join."
								: "Once an administrator adds a faculty it appears here with its departments and programmes."
						}
						action={
							canManage ? (
								<Button
									variant="primary"
									size="sm"
									icon={<Plus size={15} weight="bold" aria-hidden="true" />}
									onClick={() => setDialog({ kind: "faculty-create" })}
								>
									Add faculty
								</Button>
							) : null
						}
					/>
				</Card>
			) : (
				<div className="stack">
					<div className="academic-toolbar">
						<p className="academic-summary num">
							<span>
								<TreeStructure size={14} weight="regular" aria-hidden="true" />
								<strong>{faculties.length}</strong>{" "}
								{faculties.length === 1 ? "faculty" : "faculties"}
							</span>
							<span>
								<Buildings size={14} weight="regular" aria-hidden="true" />
								<strong>{departments}</strong>{" "}
								{departments === 1 ? "department" : "departments"}
							</span>
							<span>
								<GraduationCap size={14} weight="regular" aria-hidden="true" />
								<strong>{programmes.length}</strong>{" "}
								{programmes.length === 1 ? "programme" : "programmes"}
							</span>
							<span>
								<Student size={14} weight="regular" aria-hidden="true" />
								<strong>{students}</strong>{" "}
								{students === 1 ? "student" : "students"}
							</span>
						</p>
						<SegmentedFilter
							label="Layout"
							value={view}
							onChange={setView}
							options={[
								{ value: "chart", label: "Organigram" },
								{ value: "cards", label: "Cards" },
							]}
						/>
					</div>
					{view === "chart" ? (
						<Organigram faculties={faculties} />
					) : (
						<div className="grid grid--2 academic-grid">
							{faculties.map((faculty) => (
								<FacultyCard
									key={faculty.id}
									faculty={faculty}
									canManage={canManage}
									onDialog={setDialog}
								/>
							))}
						</div>
					)}
				</div>
			)}

			{dialog?.kind === "faculty-create" ? (
				<FacultyFormDialog onClose={close} />
			) : null}

			{dialog?.kind === "faculty-edit" ? (
				<FacultyFormDialog faculty={dialog.faculty} onClose={close} />
			) : null}

			{dialog?.kind === "faculty-delete" ? (
				<ConfirmDialog
					title={`Delete ${dialog.faculty.name}?`}
					description="A faculty can only be removed once its departments are gone."
					consequences={
						<>
							This faculty still holds{" "}
							<strong>{dialog.faculty.departments.length}</strong> departments.
							Move or delete them first; nothing is removed by this attempt.
						</>
					}
					confirmLabel="Delete faculty"
					successMessage="Faculty deleted"
					onConfirm={() => deleteFaculty.mutateAsync(dialog.faculty.id)}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "department-create" ? (
				<DepartmentFormDialog
					faculties={faculties}
					faculty={dialog.faculty}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "department-edit" ? (
				<DepartmentFormDialog
					faculties={faculties}
					department={dialog.department}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "department-delete" ? (
				<ConfirmDialog
					title={`Delete ${dialog.department.name}?`}
					description="A department can only be removed once its programmes are gone."
					consequences={
						<>
							This department still runs{" "}
							<strong>{dialog.department.programmes.length}</strong> programmes.
							Move or delete them first.
						</>
					}
					confirmLabel="Delete department"
					successMessage="Department deleted"
					onConfirm={() => deleteDepartment.mutateAsync(dialog.department.id)}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "programme-create" ? (
				<ProgrammeFormDialog
					departments={departmentOptions}
					defaultDepartmentId={dialog.department.id}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "programme-edit" ? (
				<ProgrammeFormDialog
					programme={dialog.programme}
					departments={departmentOptions}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "programme-delete" ? (
				<ConfirmDialog
					title={`Delete ${dialog.programme.name}?`}
					description="A programme can only be removed once its courses and students are gone."
					consequences={
						<>
							This programme has <strong>{dialog.programme.courses}</strong>{" "}
							courses and <strong>{dialog.programme.students}</strong> students.
							Move the courses and end the admissions first.
						</>
					}
					confirmLabel="Delete programme"
					successMessage="Programme deleted"
					onConfirm={async () => {
						await deleteProgramme.mutateAsync(dialog.programme.id);
						if (search.programme === dialog.programme.id) clearSelection();
					}}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "admission-create" ? (
				<AdmissionFormDialog programme={dialog.programme} onClose={close} />
			) : null}

			{dialog?.kind === "admission-edit" ? (
				<AdmissionFormDialog
					programme={dialog.programme}
					admission={dialog.admission}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "admission-remove" ? (
				<ConfirmDialog
					title={`Remove ${dialog.admission.name}?`}
					description={`The admission to ${dialog.programme.name} is deleted; the account stays.`}
					consequences={
						<>
							{dialog.admission.name} is currently{" "}
							<strong>{STATUS_LABEL[dialog.admission.status]}</strong> in year{" "}
							{dialog.admission.year_of_study}. Use the status instead when the
							student graduated or left: that keeps the history.
						</>
					}
					confirmLabel="Remove admission"
					successMessage="Admission removed"
					onConfirm={() =>
						removeAdmission.mutateAsync(dialog.admission.enrollment_id)
					}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "course-assign" ? (
				<CourseAssignDialog programme={dialog.programme} onClose={close} />
			) : null}
		</>
	);
}

function AcademicPage() {
	return (
		<ModuleGate moduleKey="academic">
			<AcademicContent />
		</ModuleGate>
	);
}

export const academicRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/academic",
	validateSearch: parseAcademicSearch,
	component: AcademicPage,
});
