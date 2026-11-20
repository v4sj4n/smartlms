import { Bell } from "@phosphor-icons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useAuth } from "../../auth";
import { useNotifications } from "../../queries";

/** Pinned to the icon's corner, so it still reads on the collapsed rail. */
const BADGE: CSSProperties = {
	position: "absolute",
	top: -6,
	right: -8,
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
 * Sidebar entry for the notification feed, styled like the other nav links and
 * sitting under Settings. Reads the same query as the account menu, so marking
 * something read anywhere drops the badge too.
 */
export function NotificationsNavItem({ collapsed }: { collapsed: boolean }) {
	const { session } = useAuth();
	const notifications = useNotifications(session?.user.id);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const unread = (notifications.data ?? []).filter((item) => !item.read).length;
	const active =
		pathname === "/notifications" || pathname.startsWith("/notifications/");

	// The count lives in the name, not only in the badge: the badge is a shape.
	const label =
		unread > 0 ? `Notifications, ${unread} unread` : "Notifications";

	return (
		<Link
			to="/notifications"
			className={["nav__item", active ? "nav__item--active" : ""]
				.filter(Boolean)
				.join(" ")}
			aria-current={active ? "page" : undefined}
			aria-label={label}
			title={collapsed ? label : undefined}
		>
			<span style={{ position: "relative", display: "inline-flex" }}>
				<Bell
					size={17}
					weight={active ? "fill" : "regular"}
					aria-hidden="true"
					className="nav__icon"
				/>
				{unread > 0 ? (
					<span style={BADGE} aria-hidden="true">
						{unread > 99 ? "99+" : unread}
					</span>
				) : null}
			</span>
			<span className="nav__label-text">Notifications</span>
		</Link>
	);
}
