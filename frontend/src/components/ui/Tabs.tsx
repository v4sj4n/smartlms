import {
	TabsIndicator,
	TabsList,
	TabsPanel,
	Tabs as TabsRoot,
	TabsTab,
} from "@ui-sdk/react/tabs";
import type { ReactNode } from "react";

export type TabItem = {
	value: string;
	label: ReactNode;
	icon?: ReactNode;
	disabled?: boolean;
	content: ReactNode;
};

/**
 * Underlined tab bar on ui-sdk Tabs: arrow-key roving focus, ARIA tab/panel
 * wiring and a sliding indicator. Controlled when `value` is passed.
 */
export function Tabs({
	items,
	value,
	defaultValue,
	onValueChange,
	"aria-label": ariaLabel,
	className,
}: {
	items: TabItem[];
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	"aria-label": string;
	className?: string;
}) {
	return (
		<TabsRoot<string>
			value={value}
			defaultValue={defaultValue ?? items[0]?.value}
			onValueChange={(next) => next !== null && onValueChange?.(next)}
			className={["tabs", className ?? ""].filter(Boolean).join(" ")}
		>
			<TabsList className="tabs__list" aria-label={ariaLabel}>
				{items.map((item) => (
					<TabsTab
						key={item.value}
						value={item.value}
						disabled={item.disabled}
						className="tabs__tab"
					>
						{item.icon}
						{item.label}
					</TabsTab>
				))}
				<TabsIndicator className="tabs__indicator" />
			</TabsList>
			{items.map((item) => (
				<TabsPanel key={item.value} value={item.value} className="tabs__panel">
					{item.content}
				</TabsPanel>
			))}
		</TabsRoot>
	);
}
