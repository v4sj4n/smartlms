import { Brain, CaretDown } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The model's reasoning, folded by default ("Thinking…", then "Thought for
 * Ns"). A click opens it; while open it follows the stream.
 */
export function Thinking({
	text,
	streaming,
}: {
	text: string;
	streaming: boolean;
}) {
	const [open, setOpen] = useState(false);
	const started = useRef(streaming ? Date.now() : 0);
	const [seconds, setSeconds] = useState<number | null>(null);
	const body = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (streaming) {
			if (!started.current) started.current = Date.now();
		} else if (started.current) {
			setSeconds(
				Math.max(1, Math.round((Date.now() - started.current) / 1000)),
			);
			started.current = 0;
		}
	}, [streaming]);

	useLayoutEffect(() => {
		const el = body.current;
		if (el && streaming) el.scrollTop = el.scrollHeight;
	}, [text, streaming, open]);

	const label = streaming
		? "Thinking…"
		: seconds
			? `Thought for ${seconds}s`
			: "Thought process";

	return (
		<div className="ai-step">
			<span
				className={
					streaming ? "ai-step__node ai-step__node--running" : "ai-step__node"
				}
				aria-hidden="true"
			>
				<Brain />
			</span>
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
				className="ai-step__toggle"
			>
				<span className={streaming ? "ai-shimmer" : undefined}>{label}</span>
				<CaretDown
					aria-hidden="true"
					className={
						open ? "ai-step__caret ai-step__caret--open" : "ai-step__caret"
					}
				/>
			</button>
			{open ? (
				<div ref={body} className="ai-step__body">
					{text.trim()}
				</div>
			) : null}
		</div>
	);
}
