import { Coins, Gauge, Timer } from "@phosphor-icons/react";
import type { ReplyStats } from "./preferences";

/** "Stats for nerds" footer: model · tok/sec · tokens · time-to-first. */
export function MessageStats({ stats }: { stats: ReplyStats }) {
	const tokens =
		stats.tokens === null
			? "—"
			: `${stats.estimated ? "~" : ""}${stats.tokens.toLocaleString()} tokens`;

	return (
		<div className="ai-stats" role="group" aria-label="Response statistics">
			<span className="ai-stats__model">{stats.model}</span>
			<span title="Output tokens per second">
				<Gauge aria-hidden="true" />
				{stats.tokensPerSecond === null
					? "—"
					: `${stats.tokensPerSecond.toFixed(2)} tok/sec`}
			</span>
			<span
				title={
					stats.estimated
						? "Estimated: the provider reported no usage"
						: "Output tokens"
				}
			>
				<Coins aria-hidden="true" />
				{tokens}
			</span>
			<span title="Time to first token">
				<Timer aria-hidden="true" />
				Time-to-First:{" "}
				{stats.ttft === null ? "—" : `${stats.ttft.toFixed(4)} sec`}
			</span>
		</div>
	);
}
