import { DoorOpen, User } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { ScheduleSession } from "../../api";
import { formatTime } from "../../format";
import { Badge } from "../ui";

/**
 * One lecture on the grid: when, what, and where. The whole card opens the
 * subject, using the same stretched-name-link idiom as the subject list rows so
 * the reading order stays "Mathematics I → MATH101 → Introduction to limits".
 */
export function SessionCard({ session }: { session: ScheduleSession }) {
	const time = session.ends_at
		? `${formatTime(session.starts_at)} – ${formatTime(session.ends_at)}`
		: formatTime(session.starts_at);

	return (
		<Link
			to="/subjects/$subjectId"
			params={{ subjectId: session.subject_id }}
			className="tt-session"
			title={`${session.subject_name} · ${session.title}`}
		>
			<span className="tt-session__time num">{time}</span>
			<span className="tt-session__subject">
				<span className="tt-session__subject-name">{session.subject_name}</span>
				{session.subject_code ? (
					<Badge tone="outline">{session.subject_code}</Badge>
				) : null}
			</span>
			<span className="tt-session__title">{session.title}</span>
			{session.room || session.lecturer_name ? (
				<span className="tt-session__meta">
					{session.room ? (
						<span className="tt-session__meta-item">
							<DoorOpen size={12} weight="regular" aria-hidden="true" />
							{session.room}
						</span>
					) : null}
					{session.lecturer_name ? (
						<span className="tt-session__meta-item">
							<User size={12} weight="regular" aria-hidden="true" />
							{session.lecturer_name}
						</span>
					) : null}
				</span>
			) : null}
		</Link>
	);
}
