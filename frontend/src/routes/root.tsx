import { createRootRoute, Outlet } from "@tanstack/react-router";
import { NotFoundPage } from "../components/NotFoundPage";

function RootLayout() {
	return <Outlet />;
}

export const rootRoute = createRootRoute({
	component: RootLayout,
	notFoundComponent: NotFoundPage,
});
