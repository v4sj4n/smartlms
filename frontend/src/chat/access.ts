import type { AiChatReason } from "../api";
import { useAuth } from "../auth";
import { ASSISTANT_CONFIGURE, ASSISTANT_USE } from "../permissions";
import { useAiChatModels } from "../queries";

export { ASSISTANT_CONFIGURE, ASSISTANT_USE };

export type AssistantAccess = {
	/** May open the assistant at all. */
	canUse: boolean;
	/** May manage institutional providers (personal ones stay with their owner). */
	canConfigure: boolean;
	/**
	 * A model can answer right now: a provider exists, it is switched on and
	 * keyed, and at least one of its models is enabled. Chat surfaces hide
	 * while this is false — offering a conversation that cannot be answered is
	 * worse than not offering it.
	 */
	ready: boolean;
	/** Still asking the backend; show nothing rather than flash a button. */
	checking: boolean;
	/** Which piece is missing when `ready` is false. */
	reason: AiChatReason | undefined;
};

export function useAssistantAccess(): AssistantAccess {
	const { hasPermission, isAdmin, session } = useAuth();
	// Admins always get the assistant, even with a session saved before the
	// permission existed or a per-user override that dropped it.
	const canUse = isAdmin || hasPermission(ASSISTANT_USE);
	const canConfigure = isAdmin || hasPermission(ASSISTANT_CONFIGURE);
	// Asking the backend is what tells us whether there is anything to talk to;
	// people without the permission never ask.
	const models = useAiChatModels(session?.user.id, canUse);
	return {
		canUse,
		canConfigure,
		ready: canUse && models.data?.ready === true,
		checking: canUse && models.isPending,
		reason: models.data?.reason,
	};
}
