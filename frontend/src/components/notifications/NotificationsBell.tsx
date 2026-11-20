import { Bell } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useAuth } from "../../auth";
import { useNotifications } from "../../queries";

/** Sits on top of the bell, so the badge never takes room in the row. */
const BADGE: CSSProperties = {
	position: "absolute",
	top: -5,
	right: -6,
	display: "grid",
	placeItems: "center",
	minWidth: 16,
	height: 16,
	padding: "0 4px",
	borderRadius: "var(--r-pill)",
	background: "var(--primary)",
	color: "var(--on-primary)",
	fontSize: 10,
	fontWeight: 600,
	lineHeight: 1,
	fontVariantNumeric: "tabular-nums",
	pointerEvents: "none",
};

/**
 * The shell's notifications bell: the unread count of the signed-in user's feed
 * and a link to the full page. It reads the same query as the account menu, so
 * marking something read anywhere drops this badge too.
 */
export function NotificationsBell({ className }: { className?: string }) {
	const { session } = useAuth();
	const notifications = useNotifications(session?.user.id);
	const unread = (notifications.data ?? []).filter((item) => !item.read).length;

	// The count lives in the name, not only in the badge: the badge is a shape.
	const label =
		unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

	return (
		<Link
			to="/notifications"
			className={["icon-btn", className ?? ""].filter(Boolean).join(" ")}
			aria-label={label}
			title={label}
			style={{ position: "relative", flex: "none", textDecoration: "none" }}
		>
			<Bell size={17} weight="regular" aria-hidden="true" />
			{unread > 0 ? (
				<span style={BADGE} aria-hidden="true">
					{unread > 99 ? "99+" : unread}
				</span>
			) : null}
		</Link>
	);
}
