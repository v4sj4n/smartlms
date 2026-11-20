import type { CSSProperties } from "react";
import { useState } from "react";
import type { Notification } from "../../api";
import { Button, Skeleton } from "../ui";
import { NotificationRow } from "./NotificationRow";

/** The API returns the whole feed at once, so paging is a local reveal. */
const REVEAL = 12;

const LIST: CSSProperties = {
	maxHeight: "none",
	overflow: "visible",
	gap: 0,
	padding: "6px 6px 8px",
};

const FOOTER: CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 10,
	flexWrap: "wrap",
};

/**
 * The visible slice of the feed. The rows themselves own their read state; this
 * only decides how many of them are on screen and offers the rest.
 */
export function NotificationFeed({
	items,
	onMarkRead,
	pending,
}: {
	items: Notification[];
	onMarkRead: (id: string) => void;
	pending: boolean;
}) {
	const [revealed, setRevealed] = useState(REVEAL);
	const shown = items.slice(0, revealed);
	const remaining = items.length - shown.length;

	return (
		<>
			<ul className="notif-list" style={LIST}>
				{shown.map((item, index) => (
					<NotificationRow
						key={item.id}
						notification={item}
						onMarkRead={onMarkRead}
						pending={pending}
						divider={index > 0}
					/>
				))}
			</ul>
			{remaining > 0 ? (
				<div className="card__footer" style={FOOTER}>
					<span className="num" aria-live="polite">
						Showing {shown.length} of {items.length}
					</span>
					<Button
						size="sm"
						variant="secondary"
						onClick={() => setRevealed((count) => count + REVEAL)}
					>
						Load more
					</Button>
				</div>
			) : null}
		</>
	);
}

const SKELETON_ROW: CSSProperties = {
	display: "flex",
	gap: 10,
	padding: "12px 14px",
};

const SKELETON_BODY: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	gap: 6,
	flex: "1 1 auto",
	minWidth: 0,
};

/**
 * Loading state shaped like the rows it replaces — icon chip, title, message,
 * timestamp — so the list does not jump when the feed arrives.
 */
export function NotificationFeedSkeleton({ rows = 4 }: { rows?: number }) {
	return (
		<div role="status" aria-live="polite">
			<span className="visually-hidden">Loading notifications…</span>
			{Array.from({ length: rows }, (_, index) => (
				<div
					key={index}
					style={
						index === 0
							? SKELETON_ROW
							: { ...SKELETON_ROW, borderTop: "1px solid var(--divider)" }
					}
				>
					<span
						style={{
							flex: "none",
							width: 30,
							height: 30,
							borderRadius: "var(--r-md)",
							background: "var(--bg-subtle)",
						}}
						aria-hidden="true"
					/>
					<span style={SKELETON_BODY}>
						<Skeleton variant="title" width={index % 2 === 0 ? "46%" : "34%"} />
						<Skeleton variant="line" width={index % 3 === 0 ? "78%" : "92%"} />
						<Skeleton variant="short" width="24%" />
					</span>
				</div>
			))}
		</div>
	);
}
