import { useSyncExternalStore } from "react";

/**
 * What the user currently has open, so the floating assistant can offer
 * context-aware help ("explain this lecture", "summarise this subject").
 * Pages publish their material here; the chat request reads it fresh on every
 * send, so switching pages while the panel stays open is reflected.
 */
export type ChatMaterial = {
	/** Human label shown in the panel, e.g. the lecture or subject title. */
	title: string;
	/** Optional kind: "subject" | "lecture" | "quiz" | "flashcard" | "page". */
	kind?: string;
};

let current: ChatMaterial | null = null;
const listeners = new Set<() => void>();

export function setChatMaterial(next: ChatMaterial | null) {
	if (current?.title === next?.title && current?.kind === next?.kind) {
		return;
	}
	current = next;
	for (const listener of listeners) listener();
}

export function getChatMaterial(): ChatMaterial | null {
	return current;
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function useChatMaterial(): ChatMaterial | null {
	return useSyncExternalStore(subscribe, getChatMaterial, () => null);
}
