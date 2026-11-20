import {
	BookOpen,
	CalendarBlank,
	Cards,
	Exam,
	type Icon,
	PencilSimple,
	Presentation,
	Trash,
} from "@phosphor-icons/react";
import type {
	CourseWeek,
	SubjectWeeks,
	WeekItem,
	WeekItemKind,
	WeekSeason,
} from "../../api";
import { formatDateTime } from "../../format";
import {
	Card,
	Chip,
	EmptyState,
	IconButton,
	InlineNote,
	SkeletonStack,
} from "../ui";
import { SEASON_LABEL, weekRange } from "./WeekField";

const KIND_LABEL: Record<WeekItemKind, string> = {
	lecture: "Lecture",
	assignment: "Assignment",
	quiz: "Quiz",
	flashcard: "Flashcard",
};

const KIND_ICON: Record<WeekItemKind, Icon> = {
	lecture: BookOpen,
	assignment: Presentation,
	quiz: Exam,
	flashcard: Cards,
};

/** The two halves of the academic year, in the order they are taught. */
const SEASONS: WeekSeason[] = ["FALL", "SUMMER"];

function itemDetail(item: WeekItem): string {
	if (item.due_at) return `Due ${formatDateTime(item.due_at)}`;
	if (item.scheduled_at) return formatDateTime(item.scheduled_at);
	return "";
}

function WeekItemRow({ item }: { item: WeekItem }) {
	const KindIcon = KIND_ICON[item.kind];
	const detail = itemDetail(item);
	return (
		<li className="week-item">
			<span className={`week-item__kind week-item__kind--${item.kind}`}>
				<KindIcon size={14} weight="regular" aria-hidden="true" />
				{KIND_LABEL[item.kind]}
			</span>
			<span className="week-item__title">{item.title}</span>
			{detail ? <span className="week-item__date num">{detail}</span> : null}
		</li>
	);
}

function WeekCard({
	week,
	canManage,
	onEdit,
	onDelete,
}: {
	week: CourseWeek;
	canManage: boolean;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<li>
			<article className="week-card">
				<header className="week-card__head">
					<div className="week-card__heading">
						<p className="week-card__title">
							Week {week.week_number}
							{week.title ? (
								<span className="week-card__name"> · {week.title}</span>
							) : null}
						</p>
						<p className="week-card__range num">{weekRange(week)}</p>
					</div>
					{canManage ? (
						<div className="row">
							<IconButton
								label={`Edit week ${week.week_number}`}
								icon={
									<PencilSimple size={14} weight="regular" aria-hidden="true" />
								}
								onClick={onEdit}
							/>
							<IconButton
								label={`Delete week ${week.week_number}`}
								icon={<Trash size={14} weight="regular" aria-hidden="true" />}
								tone="danger"
								onClick={onDelete}
							/>
						</div>
					) : null}
				</header>

				{week.description ? (
					<p className="week-card__description">{week.description}</p>
				) : null}

				{week.items.length === 0 ? (
					<p className="week-card__empty">
						Nothing scheduled in this week yet. Pick this week when you add a
						lecture, assignment, quiz or flashcard.
					</p>
				) : (
					<ul className="week-items">
						{week.items.map((item) => (
							<WeekItemRow key={`${item.kind}-${item.id}`} item={item} />
						))}
					</ul>
				)}
			</article>
		</li>
	);
}

/**
 * The course read week by week, the way the old LMS laid it out: the season the
 * subject runs in, then one card per week with everything taught in it, and
 * finally the content that is not in a week yet so nothing is lost.
 */
export function WeeksPanel({
	data,
	isPending,
	canManage,
	onEdit,
	onDelete,
}: {
	data: SubjectWeeks | undefined;
	isPending: boolean;
	canManage: boolean;
	onEdit: (week: CourseWeek) => void;
	onDelete: (week: CourseWeek) => void;
}) {
	if (isPending || !data) {
		return (
			<Card>
				<SkeletonStack rows={4} />
			</Card>
		);
	}

	const weeks = data.weeks;

	if (weeks.length === 0) {
		return (
			<Card>
				<EmptyState
					icon={CalendarBlank}
					title="No weeks yet"
					description={
						canManage
							? "Plan the term: add week 1, give it its dates, then file the lectures and assignments into it."
							: "Weeks appear here once the lecturer plans the term."
					}
				/>
			</Card>
		);
	}

	return (
		<div className="stack">
			{SEASONS.map((season) => {
				const seasonWeeks = weeks.filter((week) => week.season === season);
				if (seasonWeeks.length === 0) return null;
				const isCurrent = season === data.season;
				return (
					<section key={season} className="weeks-season">
						<header className="weeks-season__head">
							<div className="row">
								<h2 className="weeks-season__title">
									{SEASON_LABEL[season]} semester
								</h2>
								{isCurrent ? (
									<Chip tone="granted">This subject runs here</Chip>
								) : null}
							</div>
							<span className="weeks-season__meta num">
								{seasonWeeks.length}{" "}
								{seasonWeeks.length === 1 ? "week" : "weeks"}
								{data.school_year ? ` · ${data.school_year}` : ""}
							</span>
						</header>
						<ul className="week-list">
							{seasonWeeks.map((week) => (
								<WeekCard
									key={week.id}
									week={week}
									canManage={canManage}
									onEdit={() => onEdit(week)}
									onDelete={() => onDelete(week)}
								/>
							))}
						</ul>
					</section>
				);
			})}

			{data.unscheduled.length > 0 ? (
				<Card>
					<div className="week-unscheduled">
						<p className="week-unscheduled__title">
							Not in a week yet
							<span className="week-unscheduled__count num">
								{data.unscheduled.length}
							</span>
						</p>
						<p className="week-unscheduled__hint">
							This content belongs to the subject but to no particular week.
							Edit it from its tab and pick the week it is taught in.
						</p>
						<ul className="week-items">
							{data.unscheduled.map((item) => (
								<WeekItemRow key={`${item.kind}-${item.id}`} item={item} />
							))}
						</ul>
					</div>
				</Card>
			) : (
				<InlineNote>
					Every piece of content on this subject sits in a week.
				</InlineNote>
			)}
		</div>
	);
}
