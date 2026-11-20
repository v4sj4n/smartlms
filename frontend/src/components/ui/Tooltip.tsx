import {
	TooltipContent,
	Tooltip as TooltipRoot,
	TooltipTrigger,
} from "@ui-sdk/react/tooltip";
import type { ReactNode } from "react";

/**
 * Plain-text hint on hover/focus. The trigger renders as a button; pass an
 * `aria-label` there only if the tooltip text shouldn't name it.
 */
export function Tooltip({
	content,
	children,
	side = "top",
	triggerClassName,
}: {
	content: string;
	children: ReactNode;
	side?: "top" | "bottom" | "left" | "right";
	triggerClassName?: string;
}) {
	return (
		<TooltipRoot>
			<TooltipTrigger className={triggerClassName ?? "tooltip__trigger"}>
				{children}
			</TooltipTrigger>
			<TooltipContent className="tooltip__content" side={side} sideOffset={6}>
				{content}
			</TooltipContent>
		</TooltipRoot>
	);
}
