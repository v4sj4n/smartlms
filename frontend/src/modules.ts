import {
	Bank,
	BookOpenText,
	Buildings,
	CalendarDots,
	Cards,
	Certificate,
	ChalkboardTeacher,
	ChartLineUp,
	ChatsCircle,
	ClipboardText,
	GearSix,
	House,
	type Icon,
	ListChecks,
	ShieldCheck,
	Sparkle,
	SquaresFour,
	Student,
	UsersThree,
} from "@phosphor-icons/react";
import { humanize } from "./format";
import { ASSISTANT_USE } from "./permissions";

export type ModuleRoute =
	| { to: "/" }
	| { to: "/access" }
	| { to: "/chat" }
	| { to: "/campuses" }
	| { to: "/academic" }
	| { to: "/school-years" }
	| { to: "/subjects" }
	| { to: "/subjects/$subjectId"; params: { subjectId: string } }
	| { to: "/assignments" }
	| { to: "/assignments/$assignmentId"; params: { assignmentId: string } }
	| { to: "/grades" }
	| { to: "/record" }
	| { to: "/timetable" }
	| { to: "/settings" }
	| { to: "/users" }
	| { to: "/students" }
	| { to: "/modules/$moduleKey"; params: { moduleKey: string } };

/** Sidebar groups, in display order. "main" has no heading; "footer" is pinned
 * to the bottom of the sidebar next to the account button. */
export type NavGroup = "main" | "learning" | "progress" | "manage" | "footer";

export const NAV_GROUPS: { key: NavGroup; label?: string }[] = [
	{ key: "main" },
	{ key: "learning" },
	{ key: "progress" },
	{ key: "manage" },
	{ key: "footer" },
];

export type NavItem = {
	key: string;
	group: NavGroup;
	label: string;
	icon: Icon;
	route: ModuleRoute;
	/** False for modules the backend grants but this milestone has no screen for. */
	hasScreen: boolean;
	/** When set, the item also needs this permission key, not just the module. */
	permission?: string;
};

type ModuleDefinition = Omit<NavItem, "hasScreen">;

const moduleRoute = (moduleKey: string): ModuleRoute => ({
	to: "/modules/$moduleKey",
	params: { moduleKey },
});

// Listed in sidebar order within each group.
const MODULE_DEFINITIONS: ModuleDefinition[] = [
	{
		key: "dashboard",
		group: "main",
		label: "Dashboard",
		icon: House,
		route: { to: "/" },
	},
	{
		key: "assistant",
		group: "main",
		label: "Assistant",
		icon: Sparkle,
		route: { to: "/chat" },
		permission: ASSISTANT_USE,
	},
	{
		key: "subjects",
		group: "learning",
		label: "Subjects",
		icon: BookOpenText,
		route: { to: "/subjects" },
	},
	{
		key: "timetable",
		group: "learning",
		label: "Timetable",
		icon: CalendarDots,
		route: { to: "/timetable" },
	},
	{
		key: "lectures",
		group: "learning",
		label: "Lectures",
		icon: ChalkboardTeacher,
		route: moduleRoute("lectures"),
	},
	{
		key: "assignments",
		group: "learning",
		label: "Assignments",
		icon: ClipboardText,
		route: { to: "/assignments" },
	},
	{
		key: "quizzes",
		group: "learning",
		label: "Quizzes",
		icon: ListChecks,
		route: moduleRoute("quizzes"),
	},
	{
		key: "flashcards",
		group: "learning",
		label: "Flashcards",
		icon: Cards,
		route: moduleRoute("flashcards"),
	},
	{
		key: "forums",
		group: "learning",
		label: "Forums",
		icon: ChatsCircle,
		route: moduleRoute("forums"),
	},
	{
		key: "grades",
		group: "progress",
		label: "Grades",
		icon: ChartLineUp,
		route: { to: "/grades" },
	},
	{
		key: "records",
		group: "progress",
		label: "Study record",
		icon: Certificate,
		route: { to: "/record" },
	},
	{
		key: "campuses",
		group: "manage",
		label: "Campuses",
		icon: Buildings,
		route: { to: "/campuses" },
	},
	{
		key: "academic",
		group: "manage",
		label: "Academic structure",
		icon: Bank,
		route: { to: "/academic" },
	},
	{
		key: "school-years",
		group: "manage",
		label: "School years",
		icon: CalendarDots,
		route: { to: "/school-years" },
	},
	{
		key: "students",
		group: "manage",
		label: "Students",
		icon: Student,
		route: { to: "/students" },
	},
	{
		key: "users",
		group: "manage",
		label: "Users",
		icon: UsersThree,
		route: { to: "/users" },
	},
	{
		key: "settings",
		group: "footer",
		label: "Settings",
		icon: GearSix,
		route: { to: "/settings" },
	},
];

const ACCESS_ITEM: ModuleDefinition = {
	key: "access",
	group: "manage",
	label: "Access control",
	icon: ShieldCheck,
	route: { to: "/access" },
};

const FALLBACK_ICON = SquaresFour;

/** Content that lives inside a subject: reached from the subject page, never
 * from the sidebar. */
const SUBJECT_SCOPED_KEYS = new Set([
	"lectures",
	"seminars",
	"quizzes",
	"flashcards",
	"forums",
]);

/** Admins manage structure, not coursework: the cross-subject assignments list
 * is for the people taking and teaching subjects. */
const HIDDEN_FOR_ADMIN_KEYS = new Set(["assignments"]);

const SCREENED_KEYS = new Set([
	"dashboard",
	"students",
	"assistant",
	"campuses",
	"academic",
	"school-years",
	"subjects",
	"assignments",
	"grades",
	"records",
	"timetable",
	"settings",
	"users",
	"access",
]);

/** Icon for a module key, used by the dashboard module list too. */
export function moduleIcon(key: string): Icon {
	const known = MODULE_DEFINITIONS.find((definition) => definition.key === key);
	if (known) return known.icon;
	if (key === "access") return ACCESS_ITEM.icon;
	return FALLBACK_ICON;
}

export function moduleLabel(key: string): string {
	const known =
		MODULE_DEFINITIONS.find((definition) => definition.key === key) ??
		(key === "access" ? ACCESS_ITEM : undefined);
	return known ? known.label : humanize(key);
}

/**
 * Nav items for the signed-in user: one per module the API granted, in a stable
 * order, plus Access control for admins. Modules the API grants but this
 * milestone has no screen for still get a real page (a module overview).
 */
export function buildNavItems(
	modules: string[],
	isAdmin: boolean,
	permissions: string[] = [],
	/** False while the assistant has no model to answer with: no entry, no dead end. */
	assistantReady = true,
): NavItem[] {
	const granted = new Set(modules);
	const grantedPermissions = new Set(permissions);
	// Definitions skipped on purpose, so the defensive fallback below cannot
	// re-add them as a generic "no screen" entry.
	const suppressed = new Set<string>();
	const items: NavItem[] = [];

	for (const key of SUBJECT_SCOPED_KEYS) suppressed.add(key);
	if (isAdmin) for (const key of HIDDEN_FOR_ADMIN_KEYS) suppressed.add(key);

	for (const definition of MODULE_DEFINITIONS) {
		if (suppressed.has(definition.key)) continue;
		// Settings always shows: every user has the Appearance section.
		if (!granted.has(definition.key) && definition.key !== "settings") continue;
		// A module can refine itself with a permission: the assistant needs
		// assistant.use, not merely the module.
		if (
			definition.permission &&
			!isAdmin &&
			!grantedPermissions.has(definition.permission)
		) {
			// Same reason as below: the module is granted, the refined
			// permission is not, and the fallback must not re-add it.
			suppressed.add(definition.key);
			continue;
		}
		// The assistant only earns a place in the sidebar when it can answer.
		// An entry that leads to "there is no model yet" is a dead end; the
		// people who can fix that reach it from Settings › AI instead.
		if (definition.key === "assistant" && !assistantReady) {
			suppressed.add(definition.key);
			continue;
		}
		items.push({ ...definition, hasScreen: SCREENED_KEYS.has(definition.key) });
	}

	if (isAdmin || granted.has("users")) {
		// Sits with Users in the Manage group.
		items.push({ ...ACCESS_ITEM, hasScreen: true });
	}

	// Defensive: a module key the API adds later still appears in navigation.
	for (const key of modules) {
		if (items.some((item) => item.key === key)) continue;
		if (suppressed.has(key)) continue;
		items.push({
			key,
			group: "learning",
			label: humanize(key),
			icon: FALLBACK_ICON,
			route: moduleRoute(key),
			hasScreen: false,
		});
	}

	return items;
}

/** Nav items bucketed by group, in display order, empty groups dropped. */
export function groupNavItems(
	items: NavItem[],
): { key: NavGroup; label?: string; items: NavItem[] }[] {
	return NAV_GROUPS.map((group) => ({
		...group,
		items: items.filter((item) => item.group === group.key),
	})).filter((group) => group.items.length > 0);
}

/** The screen a pathname belongs to, for the top bar title. */
export function findNavItem(
	items: NavItem[],
	pathname: string,
): NavItem | undefined {
	const match = (route: ModuleRoute): boolean => {
		if (route.to === "/") return pathname === "/";
		if (route.to === "/modules/$moduleKey") {
			return pathname === `/modules/${route.params.moduleKey}`;
		}
		return pathname === route.to || pathname.startsWith(`${route.to}/`);
	};

	return items.find((item) => match(item.route));
}
