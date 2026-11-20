import type { GradeBand, SubjectGrade } from "../../api";
import { Badge, Card, Table, Td, Th } from "../ui";

/**
 * Student view of one subject's gradebook: the weighted components, the running
 * total, the 4-10 grade and the official value when the exam office set one.
 */
export function SubjectGradeView({
	grade,
	bands = [],
}: {
	grade: SubjectGrade;
	bands?: GradeBand[];
}) {
	const percent = grade.total_points ?? null;
	const official = grade.official_grade;

	return (
		<Card>
			<div className="grade-summary">
				<div>
					<p className="metric__label">Weighted total</p>
					<p className="metric__value num">
						{percent === null ? "–" : percent.toFixed(2)}
						<span className="metric__foot"> / 100</span>
					</p>
				</div>
				<div>
					<p className="metric__label">Grade</p>
					<p className="metric__value num">
						{grade.grade === null ? "–" : grade.grade}
						<span className="metric__foot"> / 10</span>
					</p>
				</div>
				<div>
					<p className="metric__label">Status</p>
					<p>
						<GradeStatusBadge
							status={grade.status}
							passGrade={grade.pass_grade}
						/>
					</p>
				</div>
				<div>
					<p className="metric__label">Graded</p>
					<p className="num">{Math.round(grade.coverage * 100)}%</p>
					<div className="meter" aria-hidden="true">
						<span
							className="meter__fill"
							style={{ width: `${Math.round(grade.coverage * 100)}%` }}
						/>
					</div>
				</div>
				{grade.ects ? (
					<div>
						<p className="metric__label">ECTS</p>
						<p className="num">{grade.ects}</p>
					</div>
				) : null}
			</div>

			{official !== null ? (
				<p className="inline-note">
					Official grade recorded by the exam office:{" "}
					<strong className="num">{official} / 10</strong>
					{grade.official_points !== null
						? ` (${grade.official_points} points)`
						: null}
					.
				</p>
			) : null}

			{grade.components.length === 0 ? (
				<p className="content-row__body">
					The lecturer has not published the grade breakdown for this subject
					yet.
				</p>
			) : (
				<Table caption="Grade components">
					<thead>
						<tr>
							<Th>Component</Th>
							<Th align="right">Weight</Th>
							<Th align="right">Points</Th>
							<Th align="right">Out of</Th>
							<Th>Feedback</Th>
						</tr>
					</thead>
					<tbody>
						{grade.components.map((component) => (
							<tr key={component.id}>
								<Td>
									<span className="row row--tight">
										{component.name}
										<Badge tone="outline">{component.type}</Badge>
									</span>
								</Td>
								<Td align="right">
									<span className="num">{component.weight_percent}%</span>
								</Td>
								<Td align="right">
									<span className="num">{component.points ?? "–"}</span>
								</Td>
								<Td align="right">
									<span className="num">{component.max_points}</span>
								</Td>
								<Td>{component.comment ?? ""}</Td>
							</tr>
						))}
					</tbody>
				</Table>
			)}

			{bands.length > 0 ? (
				<p className="card__hint grade-scale">
					Scale:{" "}
					{bands
						.slice()
						.sort((left, right) => right.min - left.min)
						.map((band) => `${band.min}-${band.max} → ${band.grade}`)
						.join(" · ")}
					{" · "}pass ≥ {grade.pass_grade}
				</p>
			) : null}
		</Card>
	);
}

export function GradeStatusBadge({
	status,
	passGrade,
}: {
	status: SubjectGrade["status"];
	passGrade: number;
}) {
	const tone =
		status === "passed"
			? "success"
			: status === "failed"
				? "error"
				: status === "withdrawn"
					? "warning"
					: "outline";
	const label =
		status === "in_progress"
			? "In progress"
			: status.charAt(0).toUpperCase() + status.slice(1);
	return (
		<Badge tone={tone} title={`Pass mark: ${passGrade}`}>
			{label}
		</Badge>
	);
}
