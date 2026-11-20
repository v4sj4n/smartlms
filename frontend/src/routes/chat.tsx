import { createRoute } from "@tanstack/react-router";
import { useAuth } from "../auth";
import { AiAssistant } from "../chat/AiAssistant";
import { ASSISTANT_USE, useAssistantAccess } from "../chat/access";
import { useAssistantName } from "../chat/useAssistantChat";
import { NoAccessPage } from "../components/ModuleGate";
import { PageHeader } from "../components/ui";
import { appLayoutRoute } from "./app-layout";

type ChatSearch = { session?: string };

/**
 * /chat — the assistant full page: the conversation in a card, recent chats
 * beside it on wide screens. `?session=` reopens a saved conversation (the
 * floating panel's "Open in full page" passes it along).
 */
function ChatPage() {
	const { session } = useAuth();
	const { canUse } = useAssistantAccess();
	const name = useAssistantName();
	const search = chatRoute.useSearch();

	if (!session) return null;

	if (!canUse) {
		return (
			<NoAccessPage
				moduleKey="assistant"
				label="the AI assistant"
				body={
					<>
						The assistant needs the <code>{ASSISTANT_USE}</code> permission,
						which your account does not hold. Ask an administrator if you need
						it.
					</>
				}
			/>
		);
	}

	return (
		<>
			<PageHeader
				title={name}
				description={`Ask about what your account can reach. Answers stay inside your ${session.permissions.length} permissions.`}
			/>
			<AiAssistant variant="page" sessionParam={search.session} />
		</>
	);
}

export const chatRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/chat",
	validateSearch: (search: Record<string, unknown>): ChatSearch =>
		typeof search.session === "string" && search.session
			? { session: search.session }
			: {},
	component: ChatPage,
});
