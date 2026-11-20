import { ArrowLeft, Printer, SealCheck } from "@phosphor-icons/react";
import { createRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { errorMessage } from "../api";
import { useAuth } from "../auth";
import { ModuleGate } from "../components/ModuleGate";
import { GradeScale } from "../components/record/GradeScale";
import { groupBySchoolYear } from "../components/record/history";
import { RecordYear } from "../components/record/RecordYear";
import {
	Button,
	Card,
	EmptyState,
	ErrorState,
	PageHeader,
	SkeletonStack,
} from "../components/ui";
import { Tabs } from "../components/ui/Tabs";
import { StudentDirectory } from "../components/users/StudentDirectory";
import { useStudentRecord } from "../queries";
import { appLayoutRoute } from "./app-layout";
import "../components/record/record-history.css";

/** `?student=<id>&name=<display name>`: which student staff are looking at. */
type RecordSearch = { student?: string; name?: string };

function parseRecordSearch(search: Record<string, unknown>): RecordSearch {
	const parsed: RecordSearch = {};
	if (typeof search.student === "string" && search.student)
		parsed.student = search.student;
	if (parsed.student && typeof search.name === "string" && search.name)
		parsed.name = search.name;
	return parsed;
}

/** Skeleton that mirrors the real layout: summary card above, tables below. */
function RecordSkeleton() {
	return (
		<>
			<Card>
				<SkeletonStack rows={2} />
			</Card>
			<Card>
				<SkeletonStack rows={5} />
			</Card>
		</>
	);
}

function RecordContent() {
	const { session } = useAuth();
	const search = recordRoute.useSearch();
	const isStudent = session?.user.role === "STUDENT";
	// Students always see their own card; staff pick a student first.
	const studentId = isStudent ? session?.user.id : search.student;
	const record = useStudentRecord(studentId);
	/** Year the reader picked; the newest year is the fallback. */
	const [selectedYear, setSelectedYear] = useState<string | null>(null);

	const years = useMemo(
		() => groupBySchoolYear(record.data?.entries ?? []),
		[record.data],
	);

	// A selection that no longer exists (a different student, a refetch) falls
	// back to the newest year rather than showing an empty page.
	const activeYear =
		years.find((year) => year.key === selectedYear) ?? years[0];
	const isHistory = years.length > 1;

	if (!studentId) {
		return (
			<>
				<PageHeader
					title="Study record"
					description="Pick a student to see their credits, grades and GPA."
				/>
				<StudentDirectory />
			</>
		);
	}

	return (
		<>
			{isStudent ? null : (
				<Link to="/record" className="back-link">
					<ArrowLeft size={14} weight="bold" aria-hidden="true" />
					All students
				</Link>
			)}
			<PageHeader
				eyebrow={
					activeYear && !isHistory
						? `School year ${activeYear.label}`
						: undefined
				}
				title={isStudent ? "Study record" : (search.name ?? "Study record")}
				description={
					isStudent
						? "Credits, grades and GPA for every subject you are enrolled in."
						: "Credits, grades and GPA across this student's subjects."
				}
				actions={
					<Button
						variant="secondary"
						size="sm"
						icon={<Printer size={15} weight="regular" aria-hidden="true" />}
						onClick={() => window.print()}
					>
						Print
					</Button>
				}
			/>

			{record.isPending ? (
				<RecordSkeleton />
			) : record.isError ? (
				<Card>
					<ErrorState
						title="Record could not be loaded"
						message={errorMessage(record.error)}
						onRetry={() => void record.refetch()}
					/>
				</Card>
			) : years.length === 0 ? (
				<Card>
					<EmptyState
						icon={SealCheck}
						title="Nothing on the record yet"
						description="Subjects appear once there is an enrollment and the gradebook has points."
					/>
				</Card>
			) : activeYear ? (
				<>
					{isHistory ? (
						<Tabs
							className="record-history"
							aria-label="School year"
							value={activeYear.key}
							onValueChange={setSelectedYear}
							items={years.map((year) => ({
								value: year.key,
								label: year.label,
								content: (
									<RecordYear year={year} passGrade={record.data.pass_grade} />
								),
							}))}
						/>
					) : (
						<RecordYear
							year={activeYear}
							passGrade={record.data.pass_grade}
							title="Grades and credits"
						/>
					)}
					<GradeScale bands={record.data.bands} />
				</>
			) : null}
		</>
	);
}

function RecordPage() {
	return (
		<ModuleGate moduleKey="records">
			<RecordContent />
		</ModuleGate>
	);
}

export const recordRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/record",
	validateSearch: parseRecordSearch,
	component: RecordPage,
});
