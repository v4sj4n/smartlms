import { CaretRight, GraduationCap } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	type AdmissionStatus,
	errorMessage,
	type StudentListParams,
} from "../../api";
import { initials } from "../../format";
import { useAcademicTree, useSchoolYears, useStudents } from "../../queries";
import {
	Badge,
	type BadgeTone,
	Button,
	Card,
	EmptyState,
	ErrorState,
	type PageSize,
	Pagination,
	SearchField,
	Select,
	SkeletonStack,
	Table,
	Td,
	Th,
} from "../ui";

type Filters = {
	programme: string;
	year: string;
	admitted: string;
	status: string;
	gpa: string;
	sort: string;
};

const EMPTY_FILTERS: Filters = {
	programme: "",
	year: "",
	admitted: "",
	status: "",
	gpa: "",
	sort: "name:asc",
};

/** GPA bands on the 4-10 scale, as `min-max`. */
const GPA_OPTIONS = [
	{ value: "", label: "Any GPA" },
	{ value: "9-10", label: "9 – 10" },
	{ value: "8-9", label: "8 – 9" },
	{ value: "7-8", label: "7 – 8" },
	{ value: "6-7", label: "6 – 7" },
	{ value: "4-6", label: "Below 6" },
];

const STATUS_OPTIONS = [
	{ value: "", label: "Any status" },
	{ value: "ACTIVE", label: "Active" },
	{ value: "SUSPENDED", label: "Suspended" },
	{ value: "GRADUATED", label: "Graduated" },
	{ value: "WITHDRAWN", label: "Withdrawn" },
	{ value: "UNPLACED", label: "Not admitted" },
];

const SORT_OPTIONS = [
	{ value: "name:asc", label: "Name A–Z" },
	{ value: "gpa:desc", label: "GPA, highest first" },
	{ value: "gpa:asc", label: "GPA, lowest first" },
	{ value: "credits:desc", label: "Most credits" },
	{ value: "year:asc", label: "Year of study" },
	{ value: "admitted:desc", label: "Admitted, newest first" },
];

const STATUS_TONE: Record<AdmissionStatus, BadgeTone> = {
	ACTIVE: "success",
	SUSPENDED: "warning",
	GRADUATED: "primary",
	WITHDRAWN: "neutral",
};

function toParams(filters: Filters): Partial<StudentListParams> {
	const [sort, order] = filters.sort.split(":") as [
		StudentListParams["sort"],
		StudentListParams["order"],
	];
	const [gpaMin, gpaMax] = filters.gpa
		? filters.gpa.split("-").map(Number)
		: [undefined, undefined];
	return {
		programme_id: filters.programme || undefined,
		year_of_study: filters.year ? Number(filters.year) : undefined,
		admitted_in: filters.admitted || undefined,
		status: (filters.status || undefined) as StudentListParams["status"],
		gpa_min: gpaMin,
		gpa_max: gpaMax,
		sort,
		order,
	};
}

/**
 * Searchable, filterable list of students with their programme, year and GPA.
 * Each row opens that student's study record, where staff read and override
 * results.
 */
export function StudentDirectory() {
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<PageSize>(10);

	const academic = useAcademicTree();
	const schoolYears = useSchoolYears();
	const students = useStudents({
		page,
		page_size: pageSize,
		search,
		...toParams(filters),
	});

	const programmes = (academic.data?.faculties ?? []).flatMap((faculty) =>
		faculty.departments.flatMap((department) => department.programmes),
	);
	const selectedProgramme = programmes.find(
		(programme) => programme.id === filters.programme,
	);
	const maxYears = selectedProgramme
		? selectedProgramme.duration_years
		: Math.max(3, ...programmes.map((programme) => programme.duration_years));

	const programmeOptions = [
		{ value: "", label: "All programmes" },
		...programmes.map((programme) => ({
			value: programme.id,
			label: programme.code
				? `${programme.code} · ${programme.name}`
				: programme.name,
		})),
	];
	const yearOptions = [
		{ value: "", label: "Any year" },
		...Array.from({ length: maxYears }, (_, index) => ({
			value: String(index + 1),
			label: `Year ${index + 1}`,
		})),
	];
	const admittedOptions = [
		{ value: "", label: "Any intake" },
		...(schoolYears.data?.items ?? []).map((year) => ({
			value: year.name,
			label: `Admitted ${year.name}`,
		})),
	];

	const update = (key: keyof Filters, value: string) => {
		setFilters((current) => {
			const next = { ...current, [key]: value };
			// A year beyond the new programme's length would match nobody.
			if (key === "programme" && next.year) {
				const programme = programmes.find((p) => p.id === value);
				if (programme && Number(next.year) > programme.duration_years)
					next.year = "";
			}
			return next;
		});
		setPage(1);
	};

	const filtered =
		search !== "" ||
		Object.entries(filters).some(
			([key, value]) =>
				value !== EMPTY_FILTERS[key as keyof Filters] && key !== "sort",
		);

	return (
		<Card className="card--flush">
			<div className="list-toolbar">
				<SearchField
					label="Search students"
					placeholder="Search by name or email"
					value={search}
					onChange={(value) => {
						setSearch(value);
						setPage(1);
					}}
				/>
				<Select
					compact
					aria-label="Programme"
					value={filters.programme}
					onChange={(value) => update("programme", value)}
					options={programmeOptions}
				/>
				<Select
					compact
					aria-label="Year of study"
					value={filters.year}
					onChange={(value) => update("year", value)}
					options={yearOptions}
				/>
				<Select
					compact
					aria-label="Admitted in"
					value={filters.admitted}
					onChange={(value) => update("admitted", value)}
					options={admittedOptions}
				/>
				<Select
					compact
					aria-label="Admission status"
					value={filters.status}
					onChange={(value) => update("status", value)}
					options={STATUS_OPTIONS}
				/>
				<Select
					compact
					aria-label="GPA"
					value={filters.gpa}
					onChange={(value) => update("gpa", value)}
					options={GPA_OPTIONS}
				/>
				<Select
					compact
					aria-label="Sort by"
					value={filters.sort}
					onChange={(value) => update("sort", value)}
					options={SORT_OPTIONS}
				/>
				{filtered ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setFilters(EMPTY_FILTERS);
							setSearch("");
							setPage(1);
						}}
					>
						Clear filters
					</Button>
				) : null}
			</div>

			{students.isPending ? (
				<SkeletonStack rows={6} />
			) : students.isError ? (
				<ErrorState
					title="Students could not be loaded"
					message={errorMessage(students.error)}
					onRetry={() => void students.refetch()}
				/>
			) : students.data.items.length === 0 ? (
				<EmptyState
					icon={GraduationCap}
					title={
						filtered ? "No students match these filters" : "No students yet"
					}
					description={
						filtered
							? "Loosen a filter or clear them all."
							: "Student accounts appear here once they are created."
					}
				/>
			) : (
				<>
					<Table caption="Students">
						<thead>
							<tr>
								<Th>Student</Th>
								<Th>Programme</Th>
								<Th align="right">Year</Th>
								<Th>Admitted</Th>
								<Th>Status</Th>
								<Th align="right">GPA</Th>
								<Th align="right">ECTS</Th>
								<Th>
									<span className="visually-hidden">Open record</span>
								</Th>
							</tr>
						</thead>
						<tbody>
							{students.data.items.map((student) => (
								<tr key={student.id}>
									<Td>
										<Link
											to="/record"
											search={{ student: student.id, name: student.name }}
											className="student-cell"
										>
											<span className="avatar" aria-hidden="true">
												{initials(student.name)}
											</span>
											<span className="student-cell__text">
												<span className="table__primary">{student.name}</span>
												<span className="table__secondary">
													{student.email}
												</span>
											</span>
										</Link>
									</Td>
									<Td>
										{student.programme_name ? (
											<span className="programme-cell">
												<span className="table__primary">
													{student.programme_code ?? student.programme_name}
												</span>
												{student.programme_code ? (
													<span className="table__secondary">
														{student.programme_name}
													</span>
												) : null}
											</span>
										) : (
											<span className="table__secondary">Not admitted</span>
										)}
									</Td>
									<Td align="right">
										<span className="num">{student.year_of_study ?? "—"}</span>
									</Td>
									<Td>
										<span className="num">{student.admitted_in ?? "—"}</span>
									</Td>
									<Td>
										{student.status ? (
											<Badge tone={STATUS_TONE[student.status]}>
												{student.status.toLowerCase()}
											</Badge>
										) : (
											"—"
										)}
									</Td>
									<Td align="right">
										<span className="num">
											{student.gpa === null ? "—" : student.gpa.toFixed(2)}
										</span>
									</Td>
									<Td align="right">
										<span className="num">{student.credits_earned}</span>
									</Td>
									<Td align="right">
										<Link
											to="/record"
											search={{ student: student.id, name: student.name }}
											aria-label={`Study record of ${student.name}`}
											className="student-cell__open"
										>
											<CaretRight size={14} weight="bold" aria-hidden="true" />
										</Link>
									</Td>
								</tr>
							))}
						</tbody>
					</Table>
					<div className="card__footer">
						<Pagination
							page={page}
							pageSize={pageSize}
							total={students.data.total}
							itemLabel={students.data.total === 1 ? "student" : "students"}
							onPageChange={setPage}
							onPageSizeChange={(size) => {
								setPageSize(size);
								setPage(1);
							}}
						/>
					</div>
				</>
			)}
		</Card>
	);
}
