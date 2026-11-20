import { List, SidebarSimple, X } from "@phosphor-icons/react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
	type ReactNode,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { useAuth } from "../auth";
import { useAssistantAccess } from "../chat/access";
import { FloatingChat } from "../chat/FloatingChat";
import { buildNavItems, groupNavItems, type NavItem } from "../modules";
import { NotificationsBell } from "./notifications/NotificationsBell";
import { NotificationsNavItem } from "./notifications/NotificationsNavItem";
import { UserMenu } from "./UserMenu";
import { IconButton, OptimoLogo } from "./ui";

const COLLAPSE_KEY = "optimolms.sidebar.v1";
const MOBILE_QUERY = "(max-width: 880px)";

function readCollapsed(): boolean {
	try {
		return window.localStorage.getItem(COLLAPSE_KEY) === "collapsed";
	} catch {
		return false;
	}
}

function subscribeMobile(onChange: () => void) {
	const query = window.matchMedia(MOBILE_QUERY);
	query.addEventListener("change", onChange);
	return () => query.removeEventListener("change", onChange);
}

/** True below the breakpoint where the sidebar becomes a slide-in drawer. */
function useIsMobile(): boolean {
	return useSyncExternalStore(
		subscribeMobile,
		() => window.matchMedia(MOBILE_QUERY).matches,
		() => false,
	);
}

function NavTarget({
	item,
	active,
	collapsed,
}: {
	item: NavItem;
	active: boolean;
	collapsed: boolean;
}) {
	const className = ["nav__item", active ? "nav__item--active" : ""]
		.filter(Boolean)
		.join(" ");
	const Icon = item.icon;
	const content = (
		<>
			<Icon
				size={17}
				weight={active ? "fill" : "regular"}
				aria-hidden="true"
				className="nav__icon"
			/>
			<span className="nav__label-text">{item.label}</span>
		</>
	);
	// The label text is hidden on the collapsed rail, so the link carries its
	// own name and a hover tooltip there.
	const shared = {
		className,
		"aria-current": active ? ("page" as const) : undefined,
		"aria-label": collapsed ? item.label : undefined,
		title: collapsed ? item.label : undefined,
	};

	if (item.route.to === "/modules/$moduleKey") {
		return (
			<Link
				to="/modules/$moduleKey"
				params={{ moduleKey: item.route.params.moduleKey }}
				{...shared}
			>
				{content}
			</Link>
		);
	}

	return (
		<Link to={item.route.to} {...shared}>
			{content}
		</Link>
	);
}

function pathnameMatches(item: NavItem, pathname: string): boolean {
	const route = item.route;
	if (route.to === "/") return pathname === "/";
	if (route.to === "/modules/$moduleKey") {
		return pathname === `/modules/${route.params.moduleKey}`;
	}
	return pathname === route.to || pathname.startsWith(`${route.to}/`);
}

/**
 * Application shell. On desktop the sidebar holds brand, grouped module
 * navigation, Settings and the user button, and can collapse to an icon rail.
 * Below 880px it becomes a drawer opened from a menu button in a slim top bar.
 * Pages own their titles through PageHeader.
 */
export function AppShell({ children }: { children: ReactNode }) {
	const { session, isAdmin, hasModule } = useAuth();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isMobile = useIsMobile();
	const [collapsedPreference, setCollapsedPreference] = useState(() =>
		readCollapsed(),
	);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const menuButtonRef = useRef<HTMLButtonElement>(null);
	const sidebarRef = useRef<HTMLElement>(null);
	const navRef = useRef<HTMLElement>(null);
	// The Assistant entry follows the chat surfaces: no model to answer with,
	// no entry. Everyone else's sidebar is unaffected.
	const { ready: assistantReady } = useAssistantAccess();

	// The drawer always shows the full sidebar; the rail is a desktop-only mode.
	const collapsed = collapsedPreference && !isMobile;
	const drawer = isMobile && drawerOpen;

	// Navigating, or growing past the breakpoint, closes the drawer.
	useEffect(() => {
		setDrawerOpen(false);
	}, [pathname, isMobile]);

	// Keep the current page's link visible when the module list scrolls.
	useEffect(() => {
		navRef.current
			?.querySelector<HTMLElement>('[aria-current="page"]')
			?.scrollIntoView({ block: "nearest" });
	}, [pathname, drawer]);

	useEffect(() => {
		if (!drawer) return;
		sidebarRef.current?.querySelector<HTMLElement>("a, button")?.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			setDrawerOpen(false);
		};
		// On window, so it runs after document-level handlers (the account menu)
		// that claim Escape first.
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			menuButtonRef.current?.focus();
		};
	}, [drawer]);

	if (!session) return null;

	const groups = groupNavItems(
		buildNavItems(
			session.modules,
			isAdmin,
			session.permissions,
			assistantReady,
		),
	);
	const navGroups = groups.filter((group) => group.key !== "footer");
	const footerItems =
		groups.find((group) => group.key === "footer")?.items ?? [];

	const toggleCollapsed = () => {
		setCollapsedPreference((current) => {
			const next = !current;
			try {
				window.localStorage.setItem(
					COLLAPSE_KEY,
					next ? "collapsed" : "expanded",
				);
			} catch {
				// A blocked write only costs persistence, not the current layout.
			}
			return next;
		});
	};

	const brandContent = (
		<>
			<OptimoLogo className="sidebar__logo" />
			<span className="sidebar__wordmark">
				<span className="sidebar__name">OptimoLMS</span>
			</span>
		</>
	);
	const brand = hasModule("dashboard") ? (
		<Link to="/" className="sidebar__brand" aria-label="OptimoLMS dashboard">
			{brandContent}
		</Link>
	) : (
		<div className="sidebar__brand">{brandContent}</div>
	);

	return (
		<div
			className={[
				"shell",
				collapsed ? "shell--collapsed" : "",
				drawer ? "shell--drawer-open" : "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			<a className="skip-link" href="#main">
				Skip to content
			</a>

			{isMobile ? (
				<header className="mobile-bar">
					<IconButton
						ref={menuButtonRef}
						label="Open menu"
						className="mobile-bar__menu"
						icon={<List size={20} weight="regular" aria-hidden="true" />}
						aria-expanded={drawerOpen}
						aria-controls="app-sidebar"
						onClick={() => setDrawerOpen(true)}
					/>
					{brand}
					<span style={{ marginLeft: "auto", display: "flex" }}>
						<NotificationsBell />
					</span>
				</header>
			) : null}

			{drawer ? (
				<div
					className="sidebar-backdrop"
					aria-hidden="true"
					onClick={() => setDrawerOpen(false)}
				/>
			) : null}

			<aside
				ref={sidebarRef}
				id="app-sidebar"
				className="sidebar"
				aria-label="Sidebar"
				// Off-screen drawer content must not take focus or be announced.
				inert={isMobile && !drawerOpen}
				role={drawer ? "dialog" : undefined}
				aria-modal={drawer ? true : undefined}
			>
				<div className="sidebar__head">
					{brand}
					{isMobile ? (
						<IconButton
							label="Close menu"
							className="sidebar__toggle"
							icon={<X size={16} weight="regular" aria-hidden="true" />}
							onClick={() => setDrawerOpen(false)}
						/>
					) : (
						<IconButton
							label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
							className="sidebar__toggle"
							icon={
								<SidebarSimple size={16} weight="regular" aria-hidden="true" />
							}
							aria-expanded={!collapsed}
							aria-controls="app-sidebar"
							onClick={toggleCollapsed}
						/>
					)}
				</div>

				<nav ref={navRef} className="nav" aria-label="Modules">
					{navGroups.map((group) => {
						const headingId = `nav-group-${group.key}`;
						return (
							<div
								key={group.key}
								className="nav__group"
								role="group"
								aria-labelledby={group.label ? headingId : undefined}
							>
								{group.label ? (
									<p className="nav__label" id={headingId}>
										{group.label}
									</p>
								) : null}
								{group.items.map((item) => (
									<NavTarget
										key={item.key}
										item={item}
										active={pathnameMatches(item, pathname)}
										collapsed={collapsed}
									/>
								))}
							</div>
						);
					})}
				</nav>

				<div className="sidebar__bottom">
					{footerItems.map((item) => (
						<NavTarget
							key={item.key}
							item={item}
							active={pathnameMatches(item, pathname)}
							collapsed={collapsed}
						/>
					))}
					<NotificationsNavItem collapsed={collapsed} />
					<UserMenu />
				</div>
			</aside>

			<div className="main-column" inert={drawer}>
				<main className="main" id="main">
					{children}
				</main>
				<FloatingChat />
			</div>
		</div>
	);
}
