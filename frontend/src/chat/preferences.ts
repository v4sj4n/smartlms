import { useEffect, useState } from "react";

/** "Stats for nerds": per-browser toggle for the stats line under replies. */
const STATS_KEY = "smartlms.ai.statsNerds";
const STATS_EVENT = "smartlms:stats-nerds";

export function readStatsNerds(): boolean {
	try {
		return window.localStorage.getItem(STATS_KEY) === "on";
	} catch {
		return false;
	}
}

export function useStatsForNerds(): [boolean, (on: boolean) => void] {
	const [on, setOn] = useState(readStatsNerds);
	useEffect(() => {
		const sync = () => setOn(readStatsNerds());
		window.addEventListener(STATS_EVENT, sync);
		window.addEventListener("storage", sync);
		return () => {
			window.removeEventListener(STATS_EVENT, sync);
			window.removeEventListener("storage", sync);
		};
	}, []);
	const set = (next: boolean) => {
		setOn(next);
		try {
			window.localStorage.setItem(STATS_KEY, next ? "on" : "off");
		} catch {
			// A blocked write only costs persistence, not this session.
		}
		window.dispatchEvent(new Event(STATS_EVENT));
	};
	return [on, set];
}

/** What the backend puts on a finished reply's metadata. */
export type ReplyMetadata = {
	model?: string;
	provider?: string;
	ttft_ms?: number | null;
	duration_ms?: number;
	output_tokens?: number | null;
	estimated?: boolean;
};

export type ReplyStats = {
	model: string;
	tokensPerSecond: number | null;
	tokens: number | null;
	estimated: boolean;
	ttft: number | null;
};

export function statsOf(metadata: unknown): ReplyStats | undefined {
	const meta = metadata as ReplyMetadata | undefined;
	if (!meta?.model) return undefined;
	const tokens = meta.output_tokens ?? null;
	const ttft = meta.ttft_ms != null ? meta.ttft_ms / 1000 : null;
	// Speed over the generation window only, not the wait for the first token.
	const generating =
		meta.duration_ms != null
			? (meta.duration_ms - (meta.ttft_ms ?? 0)) / 1000
			: null;
	return {
		model: meta.model,
		tokens,
		estimated: Boolean(meta.estimated),
		ttft,
		tokensPerSecond:
			tokens != null && generating != null && generating > 0
				? tokens / generating
				: null,
	};
}
