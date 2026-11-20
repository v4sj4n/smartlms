import { createRoute } from "@tanstack/react-router";
import { ModuleGate } from "../components/ModuleGate";
import { PageHeader } from "../components/ui";
import { StudentDirectory } from "../components/users/StudentDirectory";
import { appLayoutRoute } from "./app-layout";

function StudentsPage() {
	return (
		<ModuleGate moduleKey="students">
			<PageHeader
				title="Students"
				description="Everyone enrolled at the school. Open a student to see their study record."
			/>
			<StudentDirectory />
		</ModuleGate>
	);
}

export const studentsRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/students",
	component: StudentsPage,
});
