import { GraduationCap } from "@phosphor-icons/react";
import { createRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage, type SubjectGrade } from "../api";
import { useAuth } from "../auth";
import { ModuleGate } from "../components/ModuleGate";
import { StaffGradesOverview } from "../components/subjects/StaffOverviews";
import { SubjectGradeView } from "../components/subjects/SubjectGradeView";
import {
	Card,
	Chip,
	EmptyState,
	ErrorState,
	PageHeader,
	SkeletonStack,
} from "../components/ui";
import { useStudentGrades, useStudentRecord } from "../queries";
import { appLayoutRoute } from "./app-layout";

type Filter = "all" | "passed" | "failed" | "in_progress";

const FILTERS: { key: Filter; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "passed", label: "Passed" },
	{ key: "failed", label: "Failed" },
	{ key: "in_progress", label: "In progress" },
];

function GradesContent() {
	const { session } = useAuth();
	const isStudent = session?.user.role === "STUDENT";
	const grades = useStudentGrades(isStudent ? session?.user.id : undefined);
	const record = useStudentRecord(isStudent ? session?.user.id : undefined);
	const [filter, setFilter] = useState<Filter>("all");

	if (!isStudent) {
		return (
			<>
				<PageHeader
					title="Grades"
					description="How far each gradebook is filled in. Open a subject to edit components and points."
				/>
				<StaffGradesOverview />
			</>
		);
	}

	const all: SubjectGrade[] = grades.data ?? [];
	const rows =
		filter === "all" ? all : all.filter((grade) => grade.status === filter);

	const summary = record.data;

	return (
		<>
			<PageHeader
				title="Grades"
				description="Weighted totals, the 4-10 grade and where each mark comes from."
				actions={
					<Link to="/record" className="btn btn--secondary btn--sm">
						Study record
					</Link>
				}
			/>

			{summary ? (
				<Card>
					<div className="grade-summary">
						<div>
							<p className="metric__label">GPA</p>
							<p className="metric__value num">
								{summary.gpa === null ? "–" : summary.gpa.toFixed(2)}
								<span className="metric__foot"> / 10</span>
							</p>
						</div>
						<div>
							<p className="metric__label">Credits earned</p>
							<p className="metric__value num">{summary.credits_earned}</p>
						</div>
						<div>
							<p className="metric__label">In flight</p>
							<p className="metric__value num">{summary.credits_in_flight}</p>
						</div>
						<div>
							<p className="metric__label">Passed / failed</p>
							<p className="metric__value num">
								{summary.subjects_passed} / {summary.subjects_failed}
							</p>
						</div>
					</div>
				</Card>
			) : null}

			<div className="tabs" role="tablist" aria-label="Grade filters">
				{FILTERS.map((entry) => {
					const active = entry.key === filter;
					return (
						<button
							key={entry.key}
							type="button"
							role="tab"
							aria-selected={active}
							className={["tab", active ? "tab--active" : ""]
								.filter(Boolean)
								.join(" ")}
							onClick={() => setFilter(entry.key)}
						>
							<span>{entry.label}</span>
							<span className="tab__count num">
								{entry.key === "all"
									? all.length
									: all.filter((grade) => grade.status === entry.key).length}
							</span>
						</button>
					);
				})}
			</div>

			{grades.isPending ? (
				<Card>
					<SkeletonStack rows={6} />
				</Card>
			) : grades.isError ? (
				<Card>
					<ErrorState
						title="Grades could not be loaded"
						message={errorMessage(grades.error)}
						onRetry={() => void grades.refetch()}
					/>
				</Card>
			) : rows.length === 0 ? (
				<Card>
					<EmptyState
						icon={GraduationCap}
						title="No grades in this filter"
						description="Once a lecturer enters points against a component, the subject appears here with its weighted total."
					/>
				</Card>
			) : (
				<div className="stack">
					{rows.map((grade) => (
						<div key={grade.subject_id} className="stack--sm">
							<div className="row row--between">
								<h2 className="card__title">
									<Link
										to="/subjects/$subjectId"
										params={{ subjectId: grade.subject_id }}
									>
										{grade.subject_name}
									</Link>
								</h2>
								<span className="row row--tight">
									{grade.school_year ? (
										<Chip tone="muted">{grade.school_year}</Chip>
									) : null}
									<Chip tone="muted">
										{grade.semester === "SECOND" ? "Semester II" : "Semester I"}
									</Chip>
									{grade.ects ? (
										<Chip tone="muted">{grade.ects} ECTS</Chip>
									) : null}
								</span>
							</div>
							<SubjectGradeView grade={grade} bands={summary?.bands} />
						</div>
					))}
				</div>
			)}
		</>
	);
}

function GradesPage() {
	return (
		<ModuleGate moduleKey="grades">
			<GradesContent />
		</ModuleGate>
	);
}

export const gradesRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/grades",
	component: GradesPage,
});
