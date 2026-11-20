import { useAuth } from "../auth";
import { ASSISTANT_CONFIGURE, ASSISTANT_USE } from "../permissions";

export { ASSISTANT_CONFIGURE, ASSISTANT_USE };

export type AssistantAccess = {
	/** May open the assistant at all. */
	canUse: boolean;
	/** May manage institutional providers (personal ones stay with their owner). */
	canConfigure: boolean;
};

export function useAssistantAccess(): AssistantAccess {
	const { hasPermission, isAdmin } = useAuth();
	// Admins always get the assistant, even with a session saved before the
	// permission existed or a per-user override that dropped it.
	return {
		canUse: isAdmin || hasPermission(ASSISTANT_USE),
		canConfigure: isAdmin || hasPermission(ASSISTANT_CONFIGURE),
	};
}
