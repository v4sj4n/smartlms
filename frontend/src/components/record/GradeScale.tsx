import type { GradeBand } from "../../api";
import { Card, Chip } from "../ui";

/**
 * The 4–10 scale the points turn into grades.
 *
 * It is shown once, for the whole record, and deliberately not per school year:
 * `GET /api/students/{id}/record` answers with a single `bands` array (the scale
 * on file for the record), so splitting it across years would invent a
 * difference that the data does not carry.
 */
export function GradeScale({ bands }: { bands: GradeBand[] }) {
	if (bands.length === 0) return null;

	const ordered = bands.slice().sort((left, right) => right.min - left.min);

	return (
		<Card>
			<div className="gradebook__toolbar">
				<h2 className="card__title">Grade scale</h2>
				<span className="card__hint">whole record · not split by year</span>
			</div>
			<div className="record-scale">
				{ordered.map((band) => (
					<Chip key={`${band.min}-${band.max}`} tone="muted">
						<span className="num">
							{band.min}–{band.max}
						</span>{" "}
						→ {band.grade}
					</Chip>
				))}
			</div>
		</Card>
	);
}
