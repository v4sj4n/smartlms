import { useAuth } from "../auth";
import { useAiSettings } from "../queries";

/** The name the user gave the assistant, falling back to a generic one. */
export function useAssistantName(): string {
	const { session } = useAuth();
	const settings = useAiSettings(session?.user.id);
	return settings.data?.assistant_name || "AI Assistant";
}
