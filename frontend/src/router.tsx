import { createRouter } from "@tanstack/react-router";
import { academicRoute } from "./routes/academic";
import { accessRoute } from "./routes/access";
import { appLayoutRoute } from "./routes/app-layout";
import { assignmentDetailRoute } from "./routes/assignment-detail";
import { assignmentsRoute } from "./routes/assignments";
import { assistantRoute } from "./routes/assistant";
import { campusesRoute } from "./routes/campuses";
import { chatRoute } from "./routes/chat";
import { dashboardRoute } from "./routes/dashboard";
import { gradesRoute } from "./routes/grades";
import { loginRoute } from "./routes/login";
import { moduleOverviewRoute } from "./routes/module-overview";
import { notificationsRoute } from "./routes/notifications";
import { recordRoute } from "./routes/record";
import { rootRoute } from "./routes/root";
import { schoolYearsRoute } from "./routes/school-years";
import { settingsTree as settingsRoute } from "./routes/settings";
import { studentsRoute } from "./routes/students";
import { subjectDetailRoute } from "./routes/subject-detail";
import { subjectsRoute } from "./routes/subjects";
import { timetableRoute } from "./routes/timetable";
import { usersRoute } from "./routes/users";

const routeTree = rootRoute.addChildren([
	loginRoute,
	appLayoutRoute.addChildren([
		dashboardRoute,
		chatRoute,
		assistantRoute,
		campusesRoute,
		schoolYearsRoute,
		academicRoute,
		subjectsRoute,
		subjectDetailRoute,
		assignmentsRoute,
		assignmentDetailRoute,
		gradesRoute,
		recordRoute,
		timetableRoute,
		notificationsRoute,
		accessRoute,
		usersRoute,
		studentsRoute,
		settingsRoute,
		moduleOverviewRoute,
	]),
]);

export const router = createRouter({
	routeTree,
	defaultPreload: "intent",
	defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
