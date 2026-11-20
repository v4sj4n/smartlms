import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "../auth";
import { AiAssistant } from "./AiAssistant";
import { useAssistantAccess } from "./access";

/**
 * The floating assistant: a button in the corner that opens the chat panel.
 * Only people holding `assistant.use` see it (the backend refuses everyone
 * else anyway), and it hides on /chat, which is the same chat full screen.
 */
export function FloatingChat() {
	const { session } = useAuth();
	const { canUse } = useAssistantAccess();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	if (!session || !canUse || pathname === "/chat") return null;
	return <AiAssistant variant="floating" />;
}
