import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "../auth";
import { AiAssistant } from "./AiAssistant";
import { useAssistantAccess } from "./access";

/**
 * The floating assistant: a button in the corner that opens the chat panel.
 *
 * Three things have to be true before it appears: the person may use the
 * assistant (`assistant.use`, which the backend enforces anyway), a model can
 * actually answer (a provider connected, switched on, keyed, with a model
 * enabled), and the page is not /chat, which is the same chat full screen.
 */
export function FloatingChat() {
	const { session } = useAuth();
	const { canUse, ready, checking } = useAssistantAccess();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	if (!session || !canUse || checking || !ready || pathname === "/chat") {
		return null;
	}
	return <AiAssistant variant="floating" />;
}
