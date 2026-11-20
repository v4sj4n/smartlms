import {
	ArrowLeft,
	BookOpen,
	GraduationCap,
	LockKey,
	PencilSimple,
	Plus,
	Student,
	Trash,
	TreeStructure,
} from "@phosphor-icons/react";
import { createRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
	PageHeader,
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

type AcademicSearch = { programme?: string };

function parseAcademicSearch(search: Record<string, unknown>): AcademicSearch {
	return typeof search.programme === "string" && search.programme
		? { programme: search.programme }
		: {};
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
			<span className="programme-tile__head">
				<span className="programme-tile__name">{programme.name}</span>
				{programme.code ? <Chip tone="muted">{programme.code}</Chip> : null}
			</span>
			<span className="programme-tile__meta num">
				{programmeMeta(programme)}
			</span>
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
				<span className="academic-dept__name">{department.name}</span>
				<div className="row">
					{department.code ? <Chip tone="muted">{department.code}</Chip> : null}
					<span className="academic-dept__count num">
						{plural(department.students, "student", "students")}
					</span>
					{canManage ? (
						<>
							<IconButton
								label={`Add programme to ${department.name}`}
								icon={<Plus size={14} weight="bold" aria-hidden="true" />}
								onClick={() =>
									onDialog({ kind: "programme-create", department })
								}
							/>
							<IconButton
								label={`Edit ${department.name}`}
								icon={
									<PencilSimple size={14} weight="regular" aria-hidden="true" />
								}
								onClick={() =>
									onDialog({ kind: "department-edit", department })
								}
							/>
							<IconButton
								label={`Delete ${department.name}`}
								icon={<Trash size={14} weight="regular" aria-hidden="true" />}
								tone="danger"
								onClick={() =>
									onDialog({ kind: "department-delete", department })
								}
							/>
						</>
					) : null}
				</div>
			</div>

			{department.programmes.length === 0 ? (
				<p className="academic-empty">
					No programmes yet.{" "}
					{canManage ? "Add the degree this department runs." : null}
				</p>
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
	return (
		<Card>
			<CardHeader
				icon={
					<TreeStructure
						size={17}
						weight="regular"
						aria-hidden="true"
						className="card__icon"
					/>
				}
				title={faculty.name}
				hint={
					<span className="row">
						{faculty.code ? <Chip tone="muted">{faculty.code}</Chip> : null}
						<span className="num">
							{plural(faculty.students, "student", "students")}
						</span>
					</span>
				}
				actions={
					canManage ? (
						<>
							<IconButton
								label={`Add department to ${faculty.name}`}
								icon={<Plus size={15} weight="bold" aria-hidden="true" />}
								onClick={() => onDialog({ kind: "department-create", faculty })}
							/>
							<IconButton
								label={`Edit ${faculty.name}`}
								icon={
									<PencilSimple size={15} weight="regular" aria-hidden="true" />
								}
								onClick={() => onDialog({ kind: "faculty-edit", faculty })}
							/>
							<IconButton
								label={`Delete ${faculty.name}`}
								icon={<Trash size={15} weight="regular" aria-hidden="true" />}
								tone="danger"
								onClick={() => onDialog({ kind: "faculty-delete", faculty })}
							/>
						</>
					) : null
				}
			/>
			<CardBody>
				<p className="academic-faculty__meta num">
					{plural(faculty.departments.length, "department", "departments")} ·{" "}
					{plural(
						faculty.departments.reduce(
							(total, item) => total + item.programmes.length,
							0,
						),
						"programme",
						"programmes",
					)}{" "}
					· {plural(faculty.students, "student", "students")}
				</p>
				{faculty.departments.length === 0 ? (
					<p className="academic-empty">
						No departments yet.{" "}
						{canManage
							? "A faculty holds departments; add the first one."
							: null}
					</p>
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
			<Card>
				<CardHeader
					icon={
						<GraduationCap
							size={18}
							weight="regular"
							aria-hidden="true"
							className="card__icon"
						/>
					}
					title={programme.name}
					hint={
						programme.code ? <Chip tone="muted">{programme.code}</Chip> : null
					}
					actions={
						canManage ? (
							<>
								<IconButton
									label={`Edit ${programme.name}`}
									icon={
										<PencilSimple
											size={15}
											weight="regular"
											aria-hidden="true"
										/>
									}
									onClick={() =>
										onDialog({ kind: "programme-edit", programme })
									}
								/>
								<IconButton
									label={`Delete ${programme.name}`}
									icon={<Trash size={15} weight="regular" aria-hidden="true" />}
									tone="danger"
									onClick={() =>
										onDialog({ kind: "programme-delete", programme })
									}
								/>
							</>
						) : null
					}
				/>
				<CardBody>
					<div className="row row--between academic-programme__facts">
						<span className="academic-programme__path">
							{programme.faculty_name} · {programme.department_name}
						</span>
						<span className="row">
							<Badge tone="outline">{LEVEL_LABEL[programme.level]}</Badge>
							<span className="num">
								{plural(programme.duration_years, "year", "years")}
							</span>
							{programme.total_ects ? (
								<span className="num">{programme.total_ects} ECTS</span>
							) : null}
						</span>
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

	const clearSelection = () => void navigate({ to: "/academic", search: {} });
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
				<div className="grid grid--2">
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
