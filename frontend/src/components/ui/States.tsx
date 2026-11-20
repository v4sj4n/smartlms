import {
	ArrowClockwise,
	type Icon,
	Info,
	WarningCircle,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Button } from "./Button";

/** Neutral empty state: says what is missing and what the user can do next. */
export function EmptyState({
	icon: IconComponent,
	title,
	description,
	action,
}: {
	icon: Icon;
	title: string;
	description?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="state state--centered">
			<span className="state__icon">
				<IconComponent size={20} weight="regular" aria-hidden="true" />
			</span>
			<div>
				<p className="state__title">{title}</p>
				{description ? <p className="state__body">{description}</p> : null}
			</div>
			{action ? <div className="state__action">{action}</div> : null}
		</div>
	);
}

/** Failed query: what failed, why, and a retry affordance. */
export function ErrorState({
	title,
	message,
	onRetry,
}: {
	title: string;
	message: string;
	onRetry?: () => void;
}) {
	return (
		<div className="state state--error" role="alert">
			<span className="state__icon">
				<WarningCircle size={18} weight="regular" aria-hidden="true" />
			</span>
			<div>
				<p className="state__title">{title}</p>
				<p className="state__body">{message}</p>
				{onRetry ? (
					<div className="state__action">
						<Button
							size="sm"
							variant="secondary"
							icon={
								<ArrowClockwise size={14} weight="regular" aria-hidden="true" />
							}
							onClick={onRetry}
						>
							Try again
						</Button>
					</div>
				) : null}
			</div>
		</div>
	);
}

/** Informational note used where a screen is intentionally read-only. */
export function InlineNote({ children }: { children: ReactNode }) {
	return (
		<div className="state" role="note">
			<span className="state__icon">
				<Info size={18} weight="regular" aria-hidden="true" />
			</span>
			<div className="state__body">{children}</div>
		</div>
	);
}
