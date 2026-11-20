import {
	Bell,
	Books,
	Buildings,
	ClipboardText,
	GraduationCap,
	type Icon,
	Sparkle,
} from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import type { Notification } from "../../api";
import { formatDateTime, formatRelative } from "../../format";

/**
 * The feed carries a title and a message, not a type, so the icon is read out
 * of the copy: the first rule matching the title, then the message, wins, and
 * the plain bell covers everything else.
 */
const ICON_RULES: { pattern: RegExp; icon: Icon }[] = [
	{ pattern: /welcome/i, icon: Sparkle },
	{ pattern: /quiz|exam|assignment|grade|result/i, icon: ClipboardText },
	{ pattern: /course|enrol|class|lecture|teach|programme/i, icon: Books },
	{ pattern: /campus|room|building|schedule|timetable/i, icon: Buildings },
	{ pattern: /student|admission|degree|thesis/i, icon: GraduationCap },
];

function iconFor(notification: Notification): Icon {
	for (const rule of ICON_RULES) {
		if (rule.pattern.test(notification.title)) return rule.icon;
	}
	for (const rule of ICON_RULES) {
		if (rule.pattern.test(notification.message)) return rule.icon;
	}
	return Bell;
}

/** Rows are full-bleed inside the card, so they drop the menu row's rounding. */
const ROW: CSSProperties = {
	flexDirection: "row",
	alignItems: "flex-start",
	gap: 10,
	padding: "12px 14px",
	borderRadius: 0,
};

const BODY: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 4,
	flex: "1 1 auto",
	minWidth: 0,
};

/**
 * The unread dot keeps its box when the row is read, so marking a row read
 * changes its colour and tint only, never the geometry of the list.
 */
function unreadDot(unread: boolean): CSSProperties {
	return {
		flex: "none",
		width: 7,
		height: 7,
		borderRadius: "50%",
		background: unread ? "var(--primary)" : "transparent",
	};
}

function iconChip(unread: boolean): CSSProperties {
	return {
		display: "grid",
		placeItems: "center",
		flex: "none",
		width: 30,
		height: 30,
		borderRadius: "var(--r-md)",
		background: unread ? "var(--primary-soft)" : "var(--bg-subtle)",
		color: unread ? "var(--primary)" : "var(--text-muted)",
	};
}

function RowContent({ notification }: { notification: Notification }) {
	const Icon = iconFor(notification);
	const unread = !notification.read;
	return (
		<>
			<span style={iconChip(unread)}>
				<Icon
					size={15}
					weight={unread ? "fill" : "regular"}
					aria-hidden="true"
				/>
			</span>
			<span style={BODY}>
				<span className="notif__head">
					<span className="notif__title">{notification.title}</span>
					{unread ? <span className="visually-hidden">Unread</span> : null}
					<span style={unreadDot(unread)} aria-hidden="true" />
				</span>
				<span
					className="notif__message"
					style={{ WebkitLineClamp: 3, whiteSpace: "pre-line" }}
				>
					{notification.message}
				</span>
				<span className="notif__time num">
					<time dateTime={notification.created_at}>
						{formatDateTime(notification.created_at)}
					</time>
					{" · "}
					{formatRelative(notification.created_at)}
				</span>
			</span>
		</>
	);
}

/**
 * One feed row. Unread rows are buttons that mark themselves read; a read row
 * has nothing left to do, so it is plain text rather than a dead control.
 */
export function NotificationRow({
	notification,
	onMarkRead,
	pending,
	divider,
}: {
	notification: Notification;
	onMarkRead: (id: string) => void;
	/** Another row's mark-read is in flight; holds the whole list still. */
	pending: boolean;
	/** Draws the hairline against the row above. */
	divider: boolean;
}) {
	const wrapper = divider
		? { borderTop: "1px solid var(--divider)" }
		: undefined;

	if (notification.read) {
		return (
			<li style={wrapper}>
				<div className="notif notif--read" style={ROW}>
					<RowContent notification={notification} />
				</div>
			</li>
		);
	}

	return (
		<li style={wrapper}>
			<button
				type="button"
				className="notif notif--unread"
				style={{ ...ROW, opacity: pending ? 0.6 : 1 }}
				disabled={pending}
				title="Mark as read"
				aria-label={`${notification.title}, unread. Mark as read`}
				onClick={() => onMarkRead(notification.id)}
			>
				<RowContent notification={notification} />
			</button>
		</li>
	);
}
