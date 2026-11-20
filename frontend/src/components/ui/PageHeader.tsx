import type { ReactNode } from "react";

export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
}: {
	/** Small context line above the title, e.g. "PHYS101 · Computer Science". */
	eyebrow?: ReactNode;
	title: ReactNode;
	description?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<header className="page-header">
			<div>
				{eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
				<h1 className="page-header__title">{title}</h1>
				{description ? (
					<p className="page-header__description">{description}</p>
				) : null}
			</div>
			{actions ? <div className="row">{actions}</div> : null}
		</header>
	);
}
