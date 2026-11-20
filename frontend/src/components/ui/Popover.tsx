import {
	PopoverContent,
	PopoverDescription,
	Popover as PopoverRoot,
	PopoverTitle,
	PopoverTrigger,
} from "@ui-sdk/react/popover";
import type { ReactNode } from "react";

export { PopoverClose } from "@ui-sdk/react/popover";

/** Interactive floating panel: focus moves in, Escape/outside press closes. */
export function Popover({
	trigger,
	title,
	description,
	children,
	triggerClassName,
	open,
	onOpenChange,
}: {
	trigger: ReactNode;
	title?: string;
	description?: string;
	children: ReactNode;
	triggerClassName?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	return (
		<PopoverRoot open={open} onOpenChange={onOpenChange}>
			<PopoverTrigger className={triggerClassName ?? "btn btn--secondary"}>
				{trigger}
			</PopoverTrigger>
			<PopoverContent
				className="popover__content"
				sideOffset={6}
				aria-label={title ? undefined : "Details"}
			>
				{title ? (
					<PopoverTitle className="popover__title">{title}</PopoverTitle>
				) : null}
				{description ? (
					<PopoverDescription className="popover__description">
						{description}
					</PopoverDescription>
				) : null}
				{children}
			</PopoverContent>
		</PopoverRoot>
	);
}
