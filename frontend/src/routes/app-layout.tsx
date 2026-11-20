import { ArrowClockwise } from "@phosphor-icons/react";
import { createRoute, Link, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuth } from "../auth";
import { AppShell } from "../components/AppShell";
import { Button, OptimoLogo, Spinner } from "../components/ui";
import { toastInfo } from "../toast";
import { rootRoute } from "./root";

/**
 * Shown while the boot probe has no verdict yet. Without it the guard reads
 * "no session in hand" as "signed out" and bounces a returning user to /login on
 * every refresh of a protected route, losing the page they asked for.
 */
function SessionSplash({
	failed,
	onRetry,
}: {
	failed: boolean;
	onRetry: () => void;
}) {
	return (
		<div
			data-auth-status="restoring"
			style={{
				position: "fixed",
				inset: 0,
				display: "grid",
				placeItems: "center",
				padding: 24,
				background: "var(--bg-canvas)",
				color: "var(--text-primary)",
			}}
		>
			<div style={{ display: "grid", justifyItems: "center", gap: 16 }}>
				<span style={{ display: "flex", alignItems: "center", gap: 10 }}>
					<OptimoLogo className="sidebar__logo" />
					<span className="sidebar__wordmark">
						<span className="sidebar__name">OptimoLMS</span>
						<span className="sidebar__caption">Learning platform</span>
					</span>
				</span>
				{failed ? (
					<div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
						<p className="state__body" style={{ textAlign: "center" }}>
							Cannot reach the OptimoLMS server. Your session is untouched — try
							again once it is back.
						</p>
						<Button
							size="sm"
							variant="secondary"
							onClick={onRetry}
							icon={
								<ArrowClockwise size={14} weight="regular" aria-hidden="true" />
							}
						>
							Try again
						</Button>
						<Link to="/login" className="link-btn">
							Sign in instead
						</Link>
					</div>
				) : (
					<Spinner size={18} label="Checking your session…" />
				)}
			</div>
		</div>
	);
}

function AppLayout() {
	const { session, status, restoreFailed, retryRestore, signedOutAt } =
		useAuth();
	const announced = useRef(false);

	// Explain the redirect once, so landing on /login is never a surprise. A
	// deliberate sign-out already reported itself in the account menu, and a
	// probe that has not answered yet has nothing to explain.
	useEffect(() => {
		if (status !== "signed-out" || announced.current) return;
		if (signedOutAt !== null) return;
		announced.current = true;
		toastInfo("Sign in to continue", "Your OptimoLMS session is not active.");
	}, [status, signedOutAt]);

	// A session the server refused — or one that never existed — goes to sign in.
	if (status === "signed-out") return <Navigate to="/login" replace />;

	// No verdict yet. Wait for it on a splash instead of redirecting: the cookie
	// is very likely fine, and this page is where the user asked to be.
	if (status === "restoring" || !session) {
		return <SessionSplash failed={restoreFailed} onRetry={retryRestore} />;
	}

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
