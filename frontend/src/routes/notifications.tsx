import { BellSlash, CheckCircle } from "@phosphor-icons/react";
import { createRoute } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage } from "../api";
import { useAuth } from "../auth";
import {
	NotificationFeed,
	NotificationFeedSkeleton,
} from "../components/notifications/NotificationFeed";
import {
	Button,
	Card,
	EmptyState,
	ErrorState,
	PageHeader,
	SegmentedFilter,
} from "../components/ui";
import { useNotificationMutations, useNotifications } from "../queries";
import { toastApiError, toastSuccess } from "../toast";
import { appLayoutRoute } from "./app-layout";

type FeedFilter = "all" | "unread";

const FILTERS: { value: FeedFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "unread", label: "Unread" },
];

/**
 * The notification feed. Reached from the bell in the shell, so it is a route of
 * its own rather than a sidebar entry: everything the system has told this user,
 * newest and unread first, with the read actions the bell only hints at.
 */
function NotificationsPage() {
	const { session } = useAuth();
	const notifications = useNotifications(session?.user.id);
	const { markRead, markAllRead } = useNotificationMutations(session?.user.id);
	const [filter, setFilter] = useState<FeedFilter>("all");

	const items = notifications.data ?? [];
	const unread = items.filter((item) => !item.read).length;
	const shown =
		filter === "unread" ? items.filter((item) => !item.read) : items;

	const markAll = () => {
		markAllRead.mutate(undefined, {
			onSuccess: () => toastSuccess("All notifications marked read"),
			onError: (error) =>
				toastApiError(error, "Notifications could not be updated"),
		});
	};

	const onMarkRead = (id: string) => {
		markRead.mutate(id, {
			onError: (error) =>
				toastApiError(error, "Notification could not be marked read"),
		});
	};

	// Who a notification is for decides what "all caught up" means, so the
	// description counts rather than states.
	const description = notifications.isPending
		? "Everything the system has told you, read and unread."
		: unread > 0
			? `${unread} unread of ${items.length}. Click a row to mark it read.`
			: "Everything here has been read.";

	return (
		<>
			<PageHeader
				title="Notifications"
				description={description}
				actions={
					<Button
						variant="secondary"
						size="sm"
						onClick={markAll}
						disabled={unread === 0 || markAllRead.isPending}
						icon={<CheckCircle size={14} weight="regular" aria-hidden="true" />}
					>
						{markAllRead.isPending ? "Marking…" : "Mark all read"}
					</Button>
				}
			/>

			<Card>
				<div className="list-toolbar">
					<SegmentedFilter
						label="Filter notifications"
						value={filter}
						options={FILTERS}
						onChange={setFilter}
					/>
					{notifications.isPending ? null : (
						<span className="card__hint num" style={{ marginLeft: "auto" }}>
							{unread} unread · {items.length} total
						</span>
					)}
				</div>

				{notifications.isPending ? (
					<div style={{ padding: "2px 10px 10px" }}>
						<NotificationFeedSkeleton rows={4} />
					</div>
				) : notifications.isError ? (
					<ErrorState
						title="Notifications could not be loaded"
						message={errorMessage(notifications.error)}
						onRetry={() => void notifications.refetch()}
					/>
				) : items.length === 0 ? (
					<EmptyState
						icon={BellSlash}
						title="No notifications yet"
						description="Course, quiz and account updates land here as they happen."
					/>
				) : shown.length === 0 ? (
					<EmptyState
						icon={CheckCircle}
						title="You're all caught up"
						description="Nothing is unread. The All filter still has your history."
						action={
							<Button
								variant="secondary"
								size="sm"
								onClick={() => setFilter("all")}
							>
								Show all notifications
							</Button>
						}
					/>
				) : (
					// Keyed on the filter: switching it starts the reveal over rather
					// than leaving "Load more" expanded from the other list.
					<NotificationFeed
						key={filter}
						items={shown}
						onMarkRead={onMarkRead}
						pending={markRead.isPending}
					/>
				)}
			</Card>
		</>
	);
}

export const notificationsRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/notifications",
	component: NotificationsPage,
});
