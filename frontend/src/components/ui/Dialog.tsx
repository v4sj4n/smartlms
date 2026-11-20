import { X } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useRef } from "react";

/**
 * Native <dialog> in modal mode: the browser owns focus trapping, Escape and
 * the inert backdrop. Mount it to open it, unmount to close it.
 */
export function Dialog({
	title,
	description,
	children,
	footer,
	onDismiss,
	dismissible = true,
}: {
	title: string;
	description?: string;
	children: ReactNode;
	footer?: ReactNode;
	onDismiss: () => void;
	dismissible?: boolean;
}) {
	const ref = useRef<HTMLDialogElement>(null);
	const titleId = useRef(
		`dialog-title-${Math.random().toString(36).slice(2, 8)}`,
	);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		if (!element.open) element.showModal();
		return () => {
			if (element.open) element.close();
		};
	}, []);

	return (
		<dialog
			ref={ref}
			className="dialog"
			aria-labelledby={titleId.current}
			onCancel={(event) => {
				// Escape closes natively; keep the parent's state in charge instead.
				event.preventDefault();
				if (dismissible) onDismiss();
			}}
		>
			<header className="dialog__header">
				<div>
					<h2 className="dialog__title" id={titleId.current}>
						{title}
					</h2>
					{description ? (
						<p className="dialog__description">{description}</p>
					) : null}
				</div>
				<button
					type="button"
					className="icon-btn"
					aria-label="Close dialog"
					disabled={!dismissible}
					onClick={onDismiss}
				>
					<X size={16} weight="regular" aria-hidden="true" />
				</button>
			</header>
			<div className="dialog__body">{children}</div>
			{footer ? <footer className="dialog__footer">{footer}</footer> : null}
		</dialog>
	);
}
