import type { ModuleAccess, Permission } from "./api";

/**
 * Assistant permissions, mirroring the keys the backend seeds and enforces
 * (backend/internal/db/seed.go, internal/handler/ai_chat.go). Shared here so
 * the chat surfaces, the navigation and the settings page cannot drift.
 */

/** Chat with the assistant, in the floating panel and on /chat. */
export const ASSISTANT_USE = "assistant.use";

/** Manage institutional providers and their models. */
export const ASSISTANT_CONFIGURE = "assistant.configure";

/** Permissions of `module` that `granted` actually contains, in module order. */
export function grantedPermissions(
	module: ModuleAccess,
	granted: string[],
): Permission[] {
	return module.permissions.filter((permission) =>
		granted.includes(permission.key),
	);
}

/** Stable, comparable form of a permission list. */
export function permissionSignature(keys: string[]): string {
	return [...keys].sort().join(",");
}

export function isDirty(draft: string[], granted: string[]): boolean {
	return permissionSignature(draft) !== permissionSignature(granted);
}
