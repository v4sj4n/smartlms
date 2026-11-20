import { CaretLeft, CaretRight, Check } from "@phosphor-icons/react";
import { useState } from "react";
import type { AiChatModel, AiChatProvider } from "../api";
import { usePopover } from "./usePopover";

/** "Google" → "GO", "Google Gemini" → "GG": the badge shown in the composer. */
export function shortcodeOf(name: string): string {
	const words = name.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
	const code =
		words.length > 1
			? words
					.map((word) => word[0])
					.join("")
					.slice(0, 3)
			: (words[0] ?? "").slice(0, 2);
	return code.length >= 2 ? code : "AI";
}

/**
 * The provider's shortcode, doubling as the switcher: pick a provider, then
 * one of its models. Only chat-ready providers are offered.
 */
export function ModelMenu({
	providers,
	modelId,
	onPick,
}: {
	providers: AiChatProvider[];
	modelId: string | null;
	onPick: (modelId: string) => void;
}) {
	const { open, setOpen, ref } = usePopover();
	const [step, setStep] = useState<string | null>(null);
	const current = providers.find((provider) =>
		provider.models.some((model) => model.id === modelId),
	);
	const currentModel = current?.models.find((model) => model.id === modelId);
	const browsing = providers.find((provider) => provider.id === step);
	const name = (model?: AiChatModel) => model?.model_id ?? "";

	const toggle = () => {
		setOpen(!open);
		setStep(null);
	};

	return (
		<div className="ai-menu" ref={ref}>
			<button
				type="button"
				className="ai-model-pill"
				disabled={providers.length === 0}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label={
					current
						? `Model: ${current.name}, ${name(currentModel)}. Change`
						: "Choose a provider and model"
				}
				title={
					current
						? `${current.name} · ${name(currentModel)}`
						: "No provider is ready: add a key and a model under AI assistant → Providers"
				}
				onClick={toggle}
			>
				{current ? shortcodeOf(current.name) : "—"}
			</button>

			{open ? (
				<div className="ai-menu__content ai-menu__content--up" role="menu">
					{!browsing ? (
						<>
							<p className="ai-menu__label">Provider</p>
							<div className="ai-menu__scroll">
								{providers.map((provider) => (
									<button
										key={provider.id}
										type="button"
										role="menuitem"
										className={
											provider.id === current?.id
												? "ai-menu__item ai-menu__item--current"
												: "ai-menu__item"
										}
										onClick={() => setStep(provider.id)}
									>
										<span className="ai-code-tag">
											{shortcodeOf(provider.name)}
										</span>
										<span className="ai-menu__text">{provider.name}</span>
										<span className="ai-menu__count num">
											({provider.models.length})
										</span>
										<CaretRight aria-hidden="true" className="ai-menu__chev" />
									</button>
								))}
							</div>
						</>
					) : (
						<>
							<button
								type="button"
								role="menuitem"
								className="ai-menu__item"
								onClick={() => setStep(null)}
							>
								<CaretLeft aria-hidden="true" className="ai-menu__chev" />
								<span className="ai-menu__text">{browsing.name}</span>
								<span className="ai-code-tag">
									{shortcodeOf(browsing.name)}
								</span>
							</button>
							<hr className="ai-menu__sep" />
							<p className="ai-menu__label">Model</p>
							<div className="ai-menu__scroll">
								{browsing.models.map((model) => {
									const picked = model.id === modelId;
									const isDefault = model.model_id === browsing.default_model;
									return (
										<button
											key={model.id}
											type="button"
											role="menuitemradio"
											aria-checked={picked}
											className={
												picked
													? "ai-menu__item ai-menu__item--current"
													: "ai-menu__item"
											}
											onClick={() => {
												onPick(model.id);
												setOpen(false);
											}}
										>
											<span className="ai-menu__stack">
												<span className="ai-menu__mono">{model.model_id}</span>
												{isDefault ? (
													<span className="ai-menu__sub">default</span>
												) : null}
											</span>
											{picked ? (
												<Check aria-hidden="true" className="ai-menu__check" />
											) : null}
										</button>
									);
								})}
							</div>
						</>
					)}
				</div>
			) : null}
		</div>
	);
}
