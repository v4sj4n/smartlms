import { Books, CaretRight } from "@phosphor-icons/react";
import { createRoute, Link } from "@tanstack/react-router";
import { errorMessage, type Subject, type SubjectCounts } from "../api";
import { useSession } from "../auth";
import { ModuleGate } from "../components/ModuleGate";
import {
	Card,
	EmptyState,
	ErrorState,
	InlineNote,
	PageHeader,
	SkeletonStack,
} from "../components/ui";
import { moduleIcon, moduleLabel } from "../modules";
import { useStudentRecord, useSubjects } from "../queries";
import { appLayoutRoute } from "./app-layout";

/** Modules whose content belongs to a subject, and the subject tab it opens. */
const SUBJECT_CONTENT: Record<
	string,
	{
		tab: "lectures" | "quizzes" | "flashcards" | "forums";
		count?: keyof SubjectCounts;
		noun: [string, string];
		lead: string;
	}
> = {
	lectures: {
		tab: "lectures",
		count: "lectures",
		noun: ["lecture", "lectures"],
		lead: "Lectures are scheduled inside each subject. Pick one to see its timetable.",
	},
	quizzes: {
		tab: "quizzes",
		count: "quizzes",
		noun: ["quiz", "quizzes"],
		lead: "Quizzes belong to a subject. Pick one to take or manage its quizzes.",
	},
	flashcards: {
		tab: "flashcards",
		count: "flashcard_sets",
		noun: ["set", "sets"],
		lead: "Flashcard sets belong to a subject. Pick one to study its cards.",
	},
	forums: {
		tab: "forums",
		noun: ["forum", "forums"],
		lead: "Every subject has its own discussion board. Pick one to read and post.",
	},
};

function SubjectHub({ moduleKey }: { moduleKey: string }) {
	const content = SUBJECT_CONTENT[moduleKey];
	const session = useSession();
	const isStudent = session.user.role === "STUDENT";
	const subjects = useSubjects({ page: 1, page_size: 50 });
	// Students only see the subjects on their record.
	const record = useStudentRecord(isStudent ? session.user.id : undefined);
	const enrolled = new Set(
		record.data?.entries.map((entry) => entry.subject_id),
	);
	const Icon = moduleIcon(moduleKey);

	const list: Subject[] = (subjects.data?.items ?? []).filter(
		(subject) => !isStudent || enrolled.has(subject.id),
	);

	return (
		<>
			<PageHeader title={moduleLabel(moduleKey)} description={content.lead} />
			{subjects.isPending || (isStudent && record.isPending) ? (
				<Card>
					<SkeletonStack rows={4} />
				</Card>
			) : subjects.isError ? (
				<Card>
					<ErrorState
						title="Subjects could not be loaded"
						message={errorMessage(subjects.error)}
						onRetry={() => void subjects.refetch()}
					/>
				</Card>
			) : list.length === 0 ? (
				<Card>
					<EmptyState
						icon={Books}
						title="No subjects yet"
						description={
							isStudent
								? "Once you are enrolled in a subject it appears here."
								: "Create a subject first; its content is added from the subject page."
						}
					/>
				</Card>
			) : (
				<ul
					className="subject-grid"
					aria-label={`Subjects with ${moduleLabel(moduleKey)}`}
				>
					{list.map((subject) => {
						const count = content.count
							? subject.counts[content.count]
							: undefined;
						return (
							<li key={subject.id}>
								<Link
									to="/subjects/$subjectId"
									params={{ subjectId: subject.id }}
									search={
										content.tab === "lectures" ? {} : { tab: content.tab }
									}
									className="subject-card"
								>
									<span
										className="agenda__icon agenda__icon--lecture"
										aria-hidden="true"
									>
										<Icon size={16} weight="regular" />
									</span>
									<span className="subject-card__text">
										<span className="subject-card__name">{subject.name}</span>
										<span className="subject-card__meta">
											{[subject.code, subject.lecturer_name]
												.filter(Boolean)
												.join(" · ")}
										</span>
									</span>
									<span className="subject-card__foot">
										{count !== undefined ? (
											<span className="subject-card__count num">
												{count}{" "}
												{count === 1 ? content.noun[0] : content.noun[1]}
											</span>
										) : null}
										<CaretRight
											size={14}
											weight="bold"
											aria-hidden="true"
											className="subject-card__caret"
										/>
									</span>
								</Link>
							</li>
						);
					})}
				</ul>
			)}
		</>
	);
}

function ModuleOverviewPage() {
	const { moduleKey } = moduleOverviewRoute.useParams();
	const Icon = moduleIcon(moduleKey);

	return (
		<ModuleGate moduleKey={moduleKey}>
			{SUBJECT_CONTENT[moduleKey] ? (
				<SubjectHub moduleKey={moduleKey} />
			) : (
				<>
					<PageHeader
						title={moduleLabel(moduleKey)}
						description="Your role has access to this area."
					/>
					<Card>
						<EmptyState
							icon={Icon}
							title="No screen for this area yet"
							description="The module is enabled for your role, but it has no page of its own yet."
							action={
								<Link to="/" className="btn btn--secondary btn--sm">
									Back to dashboard
								</Link>
							}
						/>
						<InlineNote>Module key: {moduleKey}</InlineNote>
					</Card>
				</>
			)}
		</ModuleGate>
	);
}

export const moduleOverviewRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/modules/$moduleKey",
	component: ModuleOverviewPage,
});
