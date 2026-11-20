import { createRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "../auth";
import { AppShell } from "../components/AppShell";
import { toastInfo } from "../toast";
import { rootRoute } from "./root";

function AppLayout() {
	const { session, signedOutAt } = useAuth();
	const announced = useRef(false);

	// Explain the redirect once, so landing on /login is never a surprise.
	useEffect(() => {
		if (session || announced.current) return;
		// A deliberate sign-out already reported itself in the account menu.
		if (signedOutAt !== null) return;
		announced.current = true;
		toastInfo("Sign in to continue", "Your SmartLMS session is not active.");
	}, [session, signedOutAt]);

	// Unauthenticated visits to any protected route land on the sign-in screen.
	if (!session) return <Navigate to="/login" replace />;

	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}

export const appLayoutRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "app",
	component: AppLayout,
});
