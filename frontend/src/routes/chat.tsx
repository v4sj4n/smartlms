import { PlugsConnected } from "@phosphor-icons/react";
import { createRoute, Link } from "@tanstack/react-router";
import type { AiChatReason } from "../api";
import { useAuth } from "../auth";
import { AiAssistant } from "../chat/AiAssistant";
import { ASSISTANT_USE, useAssistantAccess } from "../chat/access";
import { useAssistantName } from "../chat/useAssistantChat";
import { NoAccessPage } from "../components/ModuleGate";
import { Card, EmptyState, PageHeader } from "../components/ui";
import { appLayoutRoute } from "./app-layout";

type ChatSearch = { session?: string };

/** What to say when the assistant has nothing to answer with. */
const NOT_READY_COPY: Record<AiChatReason, string> = {
	"": "The assistant is not available yet.",
	no_provider:
		"No AI provider is connected. An administrator connects one under AI assistant › Providers.",
	inactive_provider:
		"The AI provider is switched off or has no key stored, so no model can answer.",
	no_model:
		"The provider is connected but no model is enabled for it. Switch one on under AI assistant › Providers.",
};

/**
 * /chat — the assistant full page: the conversation in a card, recent chats
 * beside it on wide screens. `?session=` reopens a saved conversation (the
 * floating panel's "Open in full page" passes it along).
 *
 * It is also where the absence of an assistant is explained: no permission, or
 * no model to answer with.
 */
function ChatPage() {
	const { session } = useAuth();
	const { canUse, canConfigure, ready, checking, reason } =
		useAssistantAccess();
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

	if (checking) return null;

	// A provider is connected but nothing can answer: say which piece is
	// missing instead of opening a chat that would fail on the first message.
	if (!ready) {
		return (
			<>
				<PageHeader
					title={name}
					description="The assistant appears once a model is available."
				/>
				<Card>
					<EmptyState
						icon={PlugsConnected}
						title="The assistant has no model to answer with"
						description={NOT_READY_COPY[reason ?? "no_provider"]}
						action={
							canConfigure ? (
								<Link to="/assistant" className="btn btn--primary btn--sm">
									Set up a provider
								</Link>
							) : undefined
						}
					/>
				</Card>
			</>
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
