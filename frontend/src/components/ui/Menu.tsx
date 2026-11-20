import {
	MenuContent,
	MenuItem,
	MenuItemIcon,
	Menu as MenuRoot,
	MenuSeparator,
	MenuTrigger,
} from "@ui-sdk/react/menu";
import type { ReactNode } from "react";

export type MenuAction =
	| {
			key: string;
			label: string;
			icon?: ReactNode;
			destructive?: boolean;
			disabled?: boolean;
			/** Return a promise to keep the item pending until it settles. */
			onSelect: () => void | Promise<unknown>;
	  }
	| { key: string; separator: true };

/**
 * Dropdown action menu on ui-sdk Menu: typeahead, arrow keys, focus return
 * and pending state for async actions. `trigger` is the button's content.
 */
export function Menu({
	trigger,
	items,
	"aria-label": ariaLabel,
	triggerClassName,
	align = "end",
}: {
	trigger: ReactNode;
	items: MenuAction[];
	"aria-label"?: string;
	triggerClassName?: string;
	align?: "start" | "center" | "end";
}) {
	return (
		<MenuRoot>
			<MenuTrigger
				className={triggerClassName ?? "btn btn--ghost btn--sm"}
				aria-label={ariaLabel}
			>
				{trigger}
			</MenuTrigger>
			<MenuContent className="menu__content" sideOffset={4} align={align}>
				{items.map((item) =>
					"separator" in item ? (
						<MenuSeparator key={item.key} className="menu__separator" />
					) : (
						<MenuItem
							key={item.key}
							value={item.key}
							label={item.label}
							disabled={item.disabled}
							destructive={item.destructive}
							onSelect={item.onSelect}
							className="menu__item"
						>
							{item.icon ? (
								<MenuItemIcon className="menu__icon">{item.icon}</MenuItemIcon>
							) : null}
							{item.label}
						</MenuItem>
					),
				)}
			</MenuContent>
		</MenuRoot>
	);
}
