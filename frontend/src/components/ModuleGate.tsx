import { LockKey } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useRef } from "react";
import { useAuth } from "../auth";
import { moduleLabel } from "../modules";
import { toastError } from "../toast";

/** Module-level gate: the role must hold `moduleKey`. */
export function ModuleGate({
	moduleKey,
	children,
}: {
	moduleKey: string;
	children: ReactNode;
}) {
	const { hasModule } = useAuth();
	if (!hasModule(moduleKey)) return <NoAccessPage moduleKey={moduleKey} />;
	return <>{children}</>;
}

/** Module + permission gate, for pages that refine access inside a module. */
export function AccessGate({
	moduleKey,
	permissionKey,
	label,
	children,
}: {
	moduleKey: string;
	permissionKey: string;
	label?: string;
	children: ReactNode;
}) {
	const { hasModule, hasPermission } = useAuth();
	if (!hasModule(moduleKey) || !hasPermission(permissionKey)) {
		return (
			<NoAccessPage
				moduleKey={moduleKey}
				label={label}
				body={
					<>
						This screen needs the <code>{permissionKey}</code> permission. Your
						role does not hold it.
					</>
				}
			/>
		);
	}
	return <>{children}</>;
}

export function NoAccessPage({
	moduleKey,
	label,
	body,
}: {
	moduleKey: string;
	label?: string;
	body?: ReactNode;
}) {
	const title = label ?? moduleLabel(moduleKey);
	const announced = useRef(false);

	// Say why the screen is empty, once per visit.
	useEffect(() => {
		if (announced.current) return;
		announced.current = true;
		toastError(
			`No access to ${title}`,
			"Your role does not grant this screen.",
		);
	}, [title]);

	return (
		<div className="centered-page">
			<div className="centered-page__inner">
				<span className="centered-page__icon">
					<LockKey size={22} weight="regular" aria-hidden="true" />
				</span>
				<h1 className="centered-page__title">No access to {title}</h1>
				<p className="centered-page__body">
					{body ?? (
						<>
							Your role does not include the <code>{moduleKey}</code> module, so
							this screen is unavailable. Ask an administrator if you need it.
						</>
					)}
				</p>
				<div className="centered-page__actions">
					<Link to="/" className="btn btn--secondary btn--sm">
						Back to dashboard
					</Link>
				</div>
			</div>
		</div>
	);
}
