import {
	BellSlash,
	CaretDown,
	CaretUp,
	CircleNotch,
	Moon,
	SignOut,
	Sparkle,
	Sun,
	User,
	WarningCircle,
} from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import {
	type CSSProperties,
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { errorMessage, type Notification } from "../api";
import { useSaveAppearance } from "../appearance";
import { useAuth } from "../auth";
import { formatRelative, initials } from "../format";
import { useNotificationMutations, useNotifications } from "../queries";
import { useTheme } from "../theme";
import { toastApiError, toastSuccess } from "../toast";

const PANEL_WIDTH = 320;

function NotificationButton({
	notification,
	onRead,
	pending,
}: {
	notification: Notification;
	onRead: () => void;
	pending: boolean;
}) {
	return (
		<li>
			<button
				type="button"
				role="menuitem"
				className={[
					"notif",
					notification.read ? "notif--read" : "notif--unread",
				].join(" ")}
				onClick={() => {
					if (!notification.read) onRead();
				}}
				disabled={pending}
				aria-label={
					notification.read
						? `${notification.title}, read`
						: `${notification.title}, unread. Mark as read`
				}
			>
				<span className="notif__head">
					<span className="notif__title">{notification.title}</span>
					<span className="notif__time num">
						{formatRelative(notification.created_at)}
					</span>
				</span>
				<span className="notif__message">{notification.message}</span>
			</button>
		</li>
	);
}

/**
 * Sidebar footer: the user button, and the account + notifications menu it
 * opens. The panel is fixed-positioned above the trigger so the sidebar's own
 * scroll container cannot clip it.
 */
export function UserMenu() {
	const { session, signOut, isAdmin } = useAuth();
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [notifOpen, setNotifOpen] = useState(false);
	const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
	const containerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);

	const { theme } = useTheme();
	const { save: saveAppearance } = useSaveAppearance();
	const notifications = useNotifications(session?.user.id);
	const { markRead, markAllRead } = useNotificationMutations(session?.user.id);

	const items = notifications.data ?? [];
	const unread = items.filter((item) => !item.read).length;

	useLayoutEffect(() => {
		if (!open) return;
		const trigger = triggerRef.current;
		if (!trigger) return;
		const rect = trigger.getBoundingClientRect();
		const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
		setPanelStyle({
			width,
			left: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
			bottom: Math.max(8, window.innerHeight - rect.top + 8),
			maxHeight: Math.max(240, rect.top - 16),
		});
	}, [open]);

	useEffect(() => {
		if (!open) return;

		const onPointerDown = (event: MouseEvent) => {
			const target = event.target as Node;
			if (containerRef.current?.contains(target)) return;
			setOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			// Handled: the mobile drawer checks defaultPrevented and stays open.
			event.preventDefault();
			event.stopPropagation();
			setOpen(false);
			triggerRef.current?.focus();
		};
		const close = () => setOpen(false);

		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		window.addEventListener("resize", close);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("resize", close);
		};
	}, [open]);

	if (!session) return null;

	const handleSignOut = () => {
		setOpen(false);
		signOut();
		toastSuccess("Signed out");
		void navigate({ to: "/login", replace: true });
	};

	const markAll = () => {
		markAllRead.mutate(undefined, {
			onSuccess: () => toastSuccess("All notifications marked read"),
			onError: (error) =>
				toastApiError(error, "Notifications could not be updated"),
		});
	};

	// Arrow keys, Home and End move between the menu's items; Tab still works.
	const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
		if (!keys.includes(event.key)) return;
		const nodes = Array.from(
			panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
				[],
		).filter((node) => !node.hasAttribute("disabled"));
		if (nodes.length === 0) return;

		event.preventDefault();
		const current = nodes.indexOf(document.activeElement as HTMLElement);
		let next = current;
		if (event.key === "ArrowDown")
			next = current < 0 ? 0 : (current + 1) % nodes.length;
		if (event.key === "ArrowUp")
			next = current <= 0 ? nodes.length - 1 : current - 1;
		if (event.key === "Home") next = 0;
		if (event.key === "End") next = nodes.length - 1;
		nodes[next].focus();
	};

	return (
		<div className="user-menu" ref={containerRef}>
			<button
				ref={triggerRef}
				type="button"
				className="user-button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={
					unread > 0
						? `${session.user.name}, ${unread} unread notifications`
						: session.user.name
				}
				title={session.user.name}
				onClick={() => setOpen((value) => !value)}
			>
				<span className="avatar avatar--sm" aria-hidden="true">
					{initials(session.user.name)}
				</span>
				<span className="user-button__text">
					<span className="user-button__name">{session.user.name}</span>
					<span className="user-button__role">{session.user.role}</span>
				</span>
				{unread > 0 ? (
					<span className="user-button__badge num" aria-hidden="true">
						{unread}
					</span>
				) : null}
				<CaretUp
					size={12}
					weight="bold"
					className="user-button__caret"
					aria-hidden="true"
				/>
			</button>

			{open ? (
				<div
					ref={panelRef}
					className="user-menu__panel"
					role="menu"
					aria-label="Account and notifications"
					style={panelStyle}
					onKeyDown={onMenuKeyDown}
				>
					<div className="user-menu__header">
						<span className="avatar" aria-hidden="true">
							{initials(session.user.name)}
						</span>
						<div className="user-menu__identity">
							<p className="user-menu__name">{session.user.name}</p>
							<p className="user-menu__email" title={session.user.email}>
								{session.user.email}
							</p>
						</div>
						<span
							className={isAdmin ? "role-pill role-pill--admin" : "role-pill"}
						>
							{session.user.role}
						</span>
					</div>

					<div className="user-menu__actions">
						<button
							type="button"
							role="menuitem"
							className="menu-item"
							onClick={() => {
								setOpen(false);
								void navigate({ to: "/settings/profile" });
							}}
						>
							<User size={16} weight="regular" aria-hidden="true" />
							<span className="menu-item__label">Profile and security</span>
						</button>
						<button
							type="button"
							role="menuitem"
							className="menu-item"
							onClick={() => {
								setOpen(false);
								void navigate({ to: "/assistant" });
							}}
						>
							<Sparkle size={16} weight="regular" aria-hidden="true" />
							<span className="menu-item__label">AI settings</span>
						</button>
						{/* The one and only appearance control: flips light <-> dark. */}
						<button
							type="button"
							role="menuitem"
							className="menu-item"
							onClick={() =>
								saveAppearance({ theme: theme === "dark" ? "light" : "dark" })
							}
							aria-label={
								theme === "dark"
									? "Theme: dark. Switch to light"
									: "Theme: light. Switch to dark"
							}
						>
							{theme === "dark" ? (
								<Moon size={16} weight="regular" aria-hidden="true" />
							) : (
								<Sun size={16} weight="regular" aria-hidden="true" />
							)}
							<span className="menu-item__label">Theme</span>
							<span className="menu-item__hint">
								{theme === "dark" ? "Dark" : "Light"}
							</span>
						</button>
					</div>

					<div className="user-menu__section">
						<div className="user-menu__section-head">
							<button
								type="button"
								role="menuitem"
								className="user-menu__section-toggle"
								aria-expanded={notifOpen}
								aria-controls="user-menu-notifications"
								onClick={() => setNotifOpen((value) => !value)}
							>
								<CaretDown
									size={12}
									weight="bold"
									className="user-menu__section-caret"
									aria-hidden="true"
								/>
								<span className="user-menu__section-title">Notifications</span>
								{unread > 0 ? (
									<span className="user-menu__count num">{unread} new</span>
								) : null}
							</button>
							<button
								type="button"
								role="menuitem"
								className="link-button"
								onClick={markAll}
								disabled={unread === 0 || markAllRead.isPending}
							>
								{markAllRead.isPending ? "Marking…" : "Mark all read"}
							</button>
						</div>

						{notifOpen ? (
							<div
								id="user-menu-notifications"
								className="user-menu__section-body"
							>
								{notifications.isPending ? (
									<p className="user-menu__empty">
										<CircleNotch
											size={14}
											weight="bold"
											className="spinner"
											aria-hidden="true"
										/>
										Loading notifications…
									</p>
								) : notifications.isError ? (
									<div className="user-menu__error" role="alert">
										<span className="row row--tight">
											<WarningCircle
												size={14}
												weight="regular"
												aria-hidden="true"
											/>
											{errorMessage(notifications.error)}
										</span>
										<button
											type="button"
											role="menuitem"
											className="link-button"
											onClick={() => void notifications.refetch()}
										>
											Retry
										</button>
									</div>
								) : items.length === 0 ? (
									<p className="user-menu__empty">
										<BellSlash size={14} weight="regular" aria-hidden="true" />
										No notifications
									</p>
								) : (
									<ul className="notif-list">
										{items.map((notification) => (
											<NotificationButton
												key={notification.id}
												notification={notification}
												pending={markRead.isPending}
												onRead={() =>
													markRead.mutate(notification.id, {
														onError: (error) =>
															toastApiError(
																error,
																"Notification could not be marked read",
															),
													})
												}
											/>
										))}
									</ul>
								)}
							</div>
						) : null}
					</div>

					<div className="user-menu__footer">
						<button
							type="button"
							role="menuitem"
							className="user-menu__logout"
							onClick={handleSignOut}
						>
							<SignOut size={16} weight="regular" aria-hidden="true" />
							Log out
						</button>
					</div>
				</div>
			) : null}
		</div>
	);
}
