/** First human-readable message out of a TanStack Form error list. */
export function firstError(errors: unknown[]): string | undefined {
	for (const error of errors) {
		if (typeof error === "string" && error) return error;
		if (error && typeof error === "object" && "message" in error) {
			const message = (error as { message?: unknown }).message;
			if (typeof message === "string" && message) return message;
		}
	}
	return undefined;
}

/** Whole-number field value, or null when it is empty or not a number. */
export function parseInteger(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (!/^-?\d+$/.test(trimmed)) return null;
	return Number.parseInt(trimmed, 10);
}

/** Comma-separated tags -> trimmed, de-duplicated, empty-free list. */
export function parseTags(value: string): string[] {
	const seen = new Set<string>();
	for (const raw of value.split(",")) {
		const tag = raw.trim();
		if (tag) seen.add(tag);
	}
	return [...seen];
}
