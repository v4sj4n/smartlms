import { CaretDown } from "@phosphor-icons/react";
import {
	AccordionHeader,
	AccordionItem,
	AccordionPanel,
	Accordion as AccordionRoot,
	AccordionTrigger,
} from "@ui-sdk/react/accordion";
import type { ReactNode } from "react";

export type AccordionEntry = {
	value: string;
	title: ReactNode;
	meta?: ReactNode;
	content: ReactNode;
};

/** Collapsible sections, e.g. course weeks. `multiple` lets several stay open. */
export function Accordion({
	items,
	defaultValue,
	multiple = true,
}: {
	items: AccordionEntry[];
	defaultValue?: string[];
	multiple?: boolean;
}) {
	return (
		<AccordionRoot
			className="accordion"
			defaultValue={defaultValue}
			multiple={multiple}
		>
			{items.map((item) => (
				<AccordionItem
					key={item.value}
					value={item.value}
					className="accordion__item"
				>
					<AccordionHeader className="accordion__header">
						<AccordionTrigger className="accordion__trigger">
							<span className="accordion__title">{item.title}</span>
							{item.meta ? (
								<span className="accordion__meta">{item.meta}</span>
							) : null}
							<CaretDown
								className="accordion__icon"
								size={16}
								aria-hidden="true"
							/>
						</AccordionTrigger>
					</AccordionHeader>
					<AccordionPanel className="accordion__panel">
						<div className="accordion__body">{item.content}</div>
					</AccordionPanel>
				</AccordionItem>
			))}
		</AccordionRoot>
	);
}
