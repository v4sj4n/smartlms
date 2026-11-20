import {
	BookOpen,
	CalendarBlank,
	Cards,
	CaretRight,
	Exam,
	type Icon,
	PencilSimple,
	Plus,
	Presentation,
	Trash,
} from "@phosphor-icons/react";
import { useState } from "react";
import type {
	CourseWeek,
	SubjectWeeks,
	WeekItem,
	WeekItemKind,
	WeekSeason,
} from "../../api";
import { formatDateTime } from "../../format";
import { Card, Chip, EmptyState, IconButton, Menu, SkeletonStack } from "../ui";
import { GENERAL_WEEK_LABEL, SEASON_LABEL, weekRange } from "./WeekField";

const KIND_LABEL: Record<WeekItemKind, string> = {
	lecture: "Lecture",
	assignment: "Assignment",
	quiz: "Quiz",
	flashcard: "Flashcard set",
};

const KIND_ICON: Record<WeekItemKind, Icon> = {
	lecture: BookOpen,
	assignment: Presentation,
	quiz: Exam,
	flashcard: Cards,
};

/** What the + on a week can add, in the order a course actually runs. */
const ADDABLE: WeekItemKind[] = ["lecture", "assignment", "quiz", "flashcard"];

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

/**
 * One week of the course. `week` null is week 0, "General": content that
 * belongs to the whole course rather than a teaching week. It is always there,
 * has no dates, and cannot be edited or removed.
 */
function WeekCard({
	week,
	items,
	canManage,
	canAdd,
	open,
	onToggle,
	onAdd,
	onEdit,
	onDelete,
}: {
	open: boolean;
	onToggle: () => void;
	week: CourseWeek | null;
	items: WeekItem[];
	canManage: boolean;
	canAdd: Record<WeekItemKind, boolean>;
	onAdd: (kind: WeekItemKind) => void;
	onEdit: () => void;
	onDelete: () => void;
}) {
	const addable = ADDABLE.filter((kind) => canAdd[kind]);
	const number = week ? week.week_number : 0;
	const name = week ? week.title : "General";
	const editable = canManage && week !== null;
	const panelId = `week-panel-${week?.id ?? "general"}`;

	return (
		<li>
			<article className={week ? "week-card" : "week-card week-card--general"}>
				<header className="week-card__head">
					<button
						type="button"
						className="week-card__toggle"
						aria-expanded={open}
						aria-controls={panelId}
						onClick={onToggle}
					>
						<CaretRight
							size={13}
							weight="bold"
							className="week-card__caret"
							aria-hidden="true"
						/>
						<span className="week-card__title">
							Week {number}
							{name ? <span className="week-card__name"> · {name}</span> : null}
						</span>
						<span className="week-card__range num">
							{week ? weekRange(week) : "Whole course"}
						</span>
						<span className="week-card__count num">
							{items.length === 0
								? "Empty"
								: `${items.length} ${items.length === 1 ? "item" : "items"}`}
						</span>
					</button>
					{addable.length > 0 || editable ? (
						<div className="row week-card__actions">
							{addable.length > 0 ? (
								<Menu
									aria-label={`Add content to week ${number}`}
									align="end"
									triggerClassName="icon-btn"
									trigger={<Plus size={14} weight="bold" aria-hidden="true" />}
									items={addable.map((kind) => {
										const KindIcon = KIND_ICON[kind];
										return {
											key: kind,
											label: `Add ${KIND_LABEL[kind].toLowerCase()}`,
											icon: (
												<KindIcon
													size={14}
													weight="regular"
													aria-hidden="true"
												/>
											),
											onSelect: () => onAdd(kind),
										};
									})}
								/>
							) : null}
							{editable ? (
								<>
									<IconButton
										label={`Edit week ${number}`}
										icon={
											<PencilSimple
												size={14}
												weight="regular"
												aria-hidden="true"
											/>
										}
										onClick={onEdit}
									/>
									<IconButton
										label={`Delete week ${number}`}
										icon={
											<Trash size={14} weight="regular" aria-hidden="true" />
										}
										tone="danger"
										onClick={onDelete}
									/>
								</>
							) : null}
						</div>
					) : null}
				</header>

				{open ? (
					<div className="week-card__body" id={panelId}>
						{week?.description ? (
							<p className="week-card__description">{week.description}</p>
						) : null}

						{items.length === 0 ? (
							<p className="week-card__empty">
								{week
									? "Nothing in this week yet."
									: "Nothing general yet — course-wide material like the syllabus or revision sets goes here."}{" "}
								{addable.length > 0
									? "Add a lecture, assignment, quiz or flashcard set to it with the +."
									: "It fills up as the lecturer files lectures and assignments into it."}
							</p>
						) : (
							<ul className="week-items">
								{items.map((item) => (
									<WeekItemRow key={`${item.kind}-${item.id}`} item={item} />
								))}
							</ul>
						)}
					</div>
				) : null}
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
	canAdd,
	onAdd,
	onEdit,
	onDelete,
}: {
	data: SubjectWeeks | undefined;
	isPending: boolean;
	canManage: boolean;
	/** Which kinds of content this role may add, per kind. */
	canAdd: Record<WeekItemKind, boolean>;
	/** `week` null adds to week 0, General. */
	onAdd: (week: CourseWeek | null, kind: WeekItemKind) => void;
	onEdit: (week: CourseWeek) => void;
	onDelete: (week: CourseWeek) => void;
}) {
	// Open/closed per week id ("general" for week 0). Untouched weeks fall back
	// to their default: the week that contains today starts open.
	const [toggled, setToggled] = useState<Record<string, boolean>>({});

	if (isPending || !data) {
		return (
			<Card>
				<SkeletonStack rows={4} />
			</Card>
		);
	}

	const weeks = data.weeks;
	const today = new Date().toISOString().slice(0, 10);
	const containsToday = (week: CourseWeek) =>
		Boolean(
			week.starts_on &&
				week.ends_on &&
				week.starts_on <= today &&
				today <= week.ends_on,
		);
	const isOpen = (key: string, fallback: boolean) => toggled[key] ?? fallback;
	const toggle = (key: string, fallback: boolean) =>
		setToggled((current) => ({
			...current,
			[key]: !(current[key] ?? fallback),
		}));
	const generalDefault = weeks.length === 0;

	return (
		<div className="stack">
			<ul className="week-list" aria-label={GENERAL_WEEK_LABEL}>
				<WeekCard
					week={null}
					items={data.unscheduled}
					open={isOpen("general", generalDefault)}
					onToggle={() => toggle("general", generalDefault)}
					canManage={canManage}
					canAdd={canAdd}
					onAdd={(kind) => onAdd(null, kind)}
					onEdit={() => {}}
					onDelete={() => {}}
				/>
			</ul>

			{weeks.length === 0 ? (
				<Card>
					<EmptyState
						icon={CalendarBlank}
						title="No teaching weeks yet"
						description={
							canManage
								? "Plan the term: add week 1, give it its dates, then file the lectures and assignments into it."
								: "Weeks appear here once the lecturer plans the term."
						}
					/>
				</Card>
			) : null}

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
									items={week.items}
									open={isOpen(week.id, containsToday(week))}
									onToggle={() => toggle(week.id, containsToday(week))}
									canManage={canManage}
									canAdd={canAdd}
									onAdd={(kind) => onAdd(week, kind)}
									onEdit={() => onEdit(week)}
									onDelete={() => onDelete(week)}
								/>
							))}
						</ul>
					</section>
				);
			})}
		</div>
	);
}
