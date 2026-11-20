import {
	ChatsCircle,
	Check,
	CircleNotch,
	Plus,
	Trash,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { type AiSession, api } from "../api";
import { usePopover } from "./usePopover";

const PAGE_SIZE = 15;

/** "3 minutes ago", "yesterday"… */
export function ago(iso?: string): string {
	if (!iso) return "";
	const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
	const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
	const steps: [Intl.RelativeTimeFormatUnit, number][] = [
		["year", 31536000],
		["month", 2592000],
		["week", 604800],
		["day", 86400],
		["hour", 3600],
		["minute", 60],
	];
	for (const [unit, size] of steps) {
		if (Math.abs(seconds) >= size)
			return rtf.format(Math.round(seconds / size), unit);
	}
	return rtf.format(0, "second");
}

/** Pages of past conversations, newest first. */
function useSessions(userId: string, active: boolean, version: number) {
	const [items, setItems] = useState<AiSession[]>([]);
	const [nextPage, setNextPage] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);
	const [failed, setFailed] = useState(false);

	const load = useCallback(
		async (page: number) => {
			setLoading(true);
			setFailed(false);
			try {
				const data = await api.aiSessions(userId, page, PAGE_SIZE);
				setItems((previous) =>
					page === 1
						? data.items
						: [
								...previous,
								...data.items.filter(
									(s) => !previous.some((p) => p.id === s.id),
								),
							],
				);
				setNextPage(data.next_page);
			} catch {
				setFailed(true);
			} finally {
				setLoading(false);
			}
		},
		[userId],
	);

	useEffect(() => {
		if (active) void load(1);
	}, [active, version, load]);

	return { items, setItems, nextPage, loading, failed, load };
}

/** Header menu with the full history; rows can be reopened or deleted. */
export function HistoryMenu({
	userId,
	currentId,
	version,
	onPick,
	onDelete,
}: {
	userId: string;
	currentId: string | null;
	version: number;
	onPick: (id: string) => void;
	onDelete: (id: string) => Promise<void>;
}) {
	const { open, setOpen, ref } = usePopover();
	const { items, setItems, nextPage, loading, failed, load } = useSessions(
		userId,
		open,
		version,
	);

	return (
		<div className="ai-menu" ref={ref}>
			<button
				type="button"
				className="ai-icon-btn"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label="Chat history"
				title="Chat history"
				onClick={() => setOpen(!open)}
			>
				<ChatsCircle aria-hidden="true" />
			</button>
			{open ? (
				<div
					className="ai-menu__content ai-menu__content--down ai-menu__content--wide"
					role="menu"
				>
					<p className="ai-menu__label">History</p>
					<div
						className="ai-menu__scroll"
						onScroll={(event) => {
							const el = event.currentTarget;
							if (
								nextPage &&
								!loading &&
								el.scrollHeight - el.scrollTop - el.clientHeight < 80
							) {
								void load(nextPage);
							}
						}}
					>
						{items.map((session) => {
							const current = session.id === currentId;
							return (
								<div
									key={session.id}
									className={
										current
											? "ai-menu__item ai-menu__item--current ai-history-row"
											: "ai-menu__item ai-history-row"
									}
								>
									<button
										type="button"
										role="menuitem"
										className="ai-history-row__main"
										onClick={() => {
											onPick(session.id);
											setOpen(false);
										}}
									>
										<ChatsCircle aria-hidden="true" className="ai-menu__chev" />
										<span className="ai-menu__stack">
											<span className="ai-menu__text">
												{session.title || "New chat"}
											</span>
											<span className="ai-menu__sub num">
												{ago(session.updated_at)} · {session.message_count}{" "}
												{session.message_count === 1 ? "message" : "messages"}
											</span>
										</span>
										{current ? (
											<Check aria-hidden="true" className="ai-menu__check" />
										) : null}
									</button>
									<button
										type="button"
										className="ai-history-row__delete"
										aria-label={`Delete chat ${session.title || ""}`.trim()}
										title="Delete chat"
										onClick={() =>
											void onDelete(session.id).then(() =>
												setItems((previous) =>
													previous.filter((s) => s.id !== session.id),
												),
											)
										}
									>
										<Trash aria-hidden="true" />
									</button>
								</div>
							);
						})}
						{!loading && !failed && items.length === 0 ? (
							<p className="ai-menu__empty">No saved conversations yet.</p>
						) : null}
						{failed ? (
							<button
								type="button"
								className="ai-menu__retry"
								onClick={() => void load(nextPage ?? 1)}
							>
								Couldn’t load conversations. Retry
							</button>
						) : null}
						{loading ? (
							<p className="ai-menu__empty" role="status">
								<CircleNotch aria-hidden="true" className="spinner" /> Loading…
							</p>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	);
}

/** Full-page right rail: the latest conversations, "Show more" pages on. */
export function RecentChats({
	userId,
	currentId,
	version,
	onPick,
	onNew,
	canNew,
}: {
	userId: string;
	currentId: string | null;
	version: number;
	onPick: (id: string) => void;
	onNew: () => void;
	canNew: boolean;
}) {
	const [expanded, setExpanded] = useState(false);
	const { items, nextPage, loading, load } = useSessions(
		userId,
		true,
		version + (currentId ? 1 : 0),
	);
	const shown = expanded ? items : items.slice(0, 5);
	const more = expanded
		? Boolean(nextPage)
		: items.length > 5 || Boolean(nextPage);

	return (
		<aside className="ai-recent" aria-label="Recent chats">
			<div className="ai-recent__head">
				<h3 className="ai-recent__title">Recent</h3>
				<button
					type="button"
					className="ai-icon-btn"
					disabled={!canNew}
					onClick={onNew}
					aria-label="New chat"
					title="New chat"
				>
					<Plus aria-hidden="true" />
				</button>
			</div>
			<div
				className={
					expanded
						? "ai-recent__list ai-recent__list--scroll"
						: "ai-recent__list"
				}
			>
				{shown.map((session) => {
					const title = session.title || "New chat";
					return (
						<button
							key={session.id}
							type="button"
							title={title}
							aria-current={session.id === currentId || undefined}
							onClick={() => onPick(session.id)}
							className="ai-recent__item"
						>
							<span className="ai-recent__name">{title}</span>
							<span className="ai-recent__when num">
								{ago(session.updated_at)}
							</span>
						</button>
					);
				})}
				{more ? (
					<button
						type="button"
						className="ai-recent__more"
						disabled={loading}
						onClick={() => {
							if (!expanded) setExpanded(true);
							else if (nextPage) void load(nextPage);
						}}
					>
						{loading ? (
							<CircleNotch aria-hidden="true" className="spinner" />
						) : null}
						Show more
					</button>
				) : null}
			</div>
			{!loading && items.length === 0 ? (
				<p className="ai-recent__empty">No saved conversations yet.</p>
			) : null}
		</aside>
	);
}
