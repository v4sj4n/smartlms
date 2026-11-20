import { useEffect, useRef, useState } from "react";

/** Open state for a small anchored menu: closes on outside press and Escape. */
export function usePopover<T extends HTMLElement = HTMLDivElement>() {
	const [open, setOpen] = useState(false);
	const ref = useRef<T>(null);

	useEffect(() => {
		if (!open) return;
		const onPointer = (event: PointerEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node))
				setOpen(false);
		};
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				setOpen(false);
			}
		};
		document.addEventListener("pointerdown", onPointer);
		document.addEventListener("keydown", onKey, true);
		return () => {
			document.removeEventListener("pointerdown", onPointer);
			document.removeEventListener("keydown", onKey, true);
		};
	}, [open]);

	return { open, setOpen, ref };
}
