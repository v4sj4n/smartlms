import { Compass } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../auth";

export function NotFoundPage() {
	const { session } = useAuth();

	return (
		<div className="login">
			<div className="centered-page__inner">
				<span className="centered-page__icon">
					<Compass size={22} weight="regular" aria-hidden="true" />
				</span>
				<h1 className="centered-page__title">Page not found</h1>
				<p className="centered-page__body">
					That address does not match a screen in SmartLMS. It may have been
					renamed, or the link may be incomplete.
				</p>
				<div className="centered-page__actions">
					<Link
						to={session ? "/" : "/login"}
						className="btn btn--primary btn--sm"
					>
						{session ? "Go to dashboard" : "Go to sign in"}
					</Link>
				</div>
			</div>
		</div>
	);
}
