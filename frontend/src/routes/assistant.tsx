import {
	ArrowClockwise,
	Buildings,
	Check,
	CheckCircle,
	CircleNotch,
	Copy,
	Gauge,
	GearSix,
	Key,
	Plugs,
	PlugsConnected,
	Plus,
	Stack,
	Timer,
	Trash,
	User,
	WarningCircle,
	X,
} from "@phosphor-icons/react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	type AiProvider,
	type AiSettings,
	api,
	errorMessage,
	type McpTool,
	type ProviderHealth,
	providerErrorCode,
} from "../api";
import { useAuth } from "../auth";
import { useAssistantAccess } from "../chat/access";
import { useStatsForNerds } from "../chat/preferences";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { McpAppsPanel } from "../components/mcp/McpAppsPanel";
import {
	Badge,
	Button,
	Card,
	CardHeader,
	Dialog,
	EmptyState,
	ErrorState,
	IconButton,
	InlineNote,
	PageHeader,
	SkeletonStack,
	Switch,
	TextArea,
	TextField,
} from "../components/ui";
import { formatRelative, humanize } from "../format";
import {
	useAiProviderList,
	useAiProviderMutations,
	useAiSettings,
	useConnectMcpApp,
	useDisconnectMcpApp,
	useMcpServerTools,
	useProviderModels,
	useUpdateAiSettings,
} from "../queries";
import { toast, toastApiError, toastError, toastSuccess } from "../toast";
import { appLayoutRoute } from "./app-layout";

/* --- Shared bits ----------------------------------------------------------- */

type AssistantTab = "general" | "personalization" | "providers" | "mcp";

const TABS: { key: AssistantTab; label: string }[] = [
	{ key: "general", label: "General" },
	{ key: "personalization", label: "Personalization" },
	{ key: "providers", label: "Providers" },
	{ key: "mcp", label: "MCP" },
];

function initials2(name: string): string {
	const words = name.split(/\s+/).filter(Boolean);
	if (words.length === 0) return "??";
	return words
		.slice(0, 2)
		.map((word) => word[0]!.toUpperCase())
		.join("");
}

/* --- General tab: name, instructions, reply length, stats ------------------- */

const PROMPT_LIMIT = 4000;

/** Reply-length presets; 0 means the provider decides. */
const LENGTH_PRESETS: { value: number; label: string; hint: string }[] = [
	{ value: 0, label: "No limit", hint: "Provider default" },
	{ value: 512, label: "Short", hint: "512 tokens" },
	{ value: 1024, label: "Medium", hint: "1,024 tokens" },
	{ value: 4096, label: "Long", hint: "4,096 tokens" },
];

function PromptField({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	const ref = useRef<HTMLTextAreaElement>(null);
	const used = value.length;
	const ratio = used / PROMPT_LIMIT;

	// Grows with its content up to a comfortable height, then scrolls.
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(Math.max(el.scrollHeight, 168), 420)}px`;
	}, [value]);

	return (
		<div className="prompt-field">
			<label className="prompt-field__label" htmlFor="system-prompt">
				System prompt
			</label>
			<p className="prompt-field__hint" id="system-prompt-hint">
				Sent before every conversation. Describe the tone, what the assistant is
				for and anything it should always or never do.
			</p>
			<div
				className={
					ratio >= 1
						? "prompt-field__box prompt-field__box--full"
						: "prompt-field__box"
				}
			>
				<textarea
					ref={ref}
					id="system-prompt"
					className="prompt-field__input"
					value={value}
					maxLength={PROMPT_LIMIT}
					aria-describedby="system-prompt-hint system-prompt-count"
					placeholder={
						"You are a patient tutor for university students.\nExplain step by step and end with a short check-your-understanding question."
					}
					onChange={(event) => onChange(event.target.value)}
				/>
				<div className="prompt-field__foot">
					<span className="prompt-field__meta">Markdown is fine</span>
					<span
						id="system-prompt-count"
						className={
							ratio >= 0.9
								? "prompt-field__count prompt-field__count--warn num"
								: "prompt-field__count num"
						}
					>
						{used.toLocaleString()} / {PROMPT_LIMIT.toLocaleString()}
					</span>
				</div>
			</div>
		</div>
	);
}

function ReplyLengthCard({
	value,
	onChange,
}: {
	value: number;
	onChange: (value: number) => void;
}) {
	const preset = LENGTH_PRESETS.find((entry) => entry.value === value);
	const [custom, setCustom] = useState(!preset);
	const [text, setText] = useState(preset ? "" : String(value));

	useEffect(() => {
		// Follow outside changes (a save from elsewhere, a discard).
		const matches = LENGTH_PRESETS.some((entry) => entry.value === value);
		if (!matches) {
			setCustom(true);
			setText(String(value));
		}
	}, [value]);

	const parsed = Number(text);
	const invalid =
		custom &&
		(text.trim() === "" ||
			!Number.isInteger(parsed) ||
			parsed < 64 ||
			parsed > 32000);

	return (
		<Card>
			<CardHeader
				title="Reply length"
				hint="The most tokens one reply may use. Longer replies stop at the cap."
			/>
			<div className="card__body stack--sm">
				<div
					className="length-options"
					role="radiogroup"
					aria-label="Maximum reply length"
				>
					{LENGTH_PRESETS.map((entry) => {
						const active = !custom && value === entry.value;
						return (
							<button
								key={entry.value}
								type="button"
								role="radio"
								aria-checked={active}
								className={
									active
										? "length-option length-option--active"
										: "length-option"
								}
								onClick={() => {
									setCustom(false);
									onChange(entry.value);
								}}
							>
								<span className="length-option__label">{entry.label}</span>
								<span className="length-option__hint num">{entry.hint}</span>
							</button>
						);
					})}
					<button
						type="button"
						role="radio"
						aria-checked={custom}
						className={
							custom ? "length-option length-option--active" : "length-option"
						}
						onClick={() => {
							setCustom(true);
							const start = value > 0 ? value : 2048;
							setText(String(start));
							onChange(start);
						}}
					>
						<span className="length-option__label">Custom</span>
						<span className="length-option__hint">64 – 32,000</span>
					</button>
				</div>

				{custom ? (
					<div className="length-custom">
						<label className="field__label" htmlFor="max-output-tokens">
							Max output tokens
						</label>
						<div className="length-custom__row">
							<input
								id="max-output-tokens"
								className="input length-custom__input num"
								inputMode="numeric"
								value={text}
								aria-invalid={invalid || undefined}
								onChange={(event) => {
									const next = event.target.value.replace(/[^0-9]/g, "");
									setText(next);
									const number = Number(next);
									if (
										Number.isInteger(number) &&
										number >= 64 &&
										number <= 32000
									) {
										onChange(number);
									}
								}}
							/>
							<span className="length-custom__words">
								{invalid
									? "Enter a whole number between 64 and 32,000"
									: `≈ ${Math.round(parsed * 0.75).toLocaleString()} words`}
							</span>
						</div>
					</div>
				) : null}
			</div>
		</Card>
	);
}

function GeneralTab({
	draft,
	onChange,
}: {
	draft: AiSettings;
	onChange: (patch: Partial<AiSettings>) => void;
}) {
	const [statsNerds, setStatsNerds] = useStatsForNerds();

	return (
		<div className="stack">
			<Card>
				<CardHeader
					title="Identity"
					hint="How the assistant introduces itself."
				/>
				<div className="card__body stack">
					<TextField
						label="Name"
						value={draft.assistant_name}
						onChange={(value) => onChange({ assistant_name: value })}
						placeholder="AI Assistant"
					/>
					<PromptField
						value={draft.system_prompt}
						onChange={(value) => onChange({ system_prompt: value })}
					/>
				</div>
			</Card>

			<ReplyLengthCard
				value={draft.max_output_tokens ?? 0}
				onChange={(value) => onChange({ max_output_tokens: value })}
			/>

			<Card>
				<div className="stats-row">
					<div>
						<p className="stats-row__title">Stats for nerds</p>
						<p className="stats-row__desc">
							Show the model, speed, output tokens and time to first token under
							each assistant reply. Saved in this browser only, applies right
							away.
						</p>
					</div>
					<Switch
						checked={statsNerds}
						onChange={setStatsNerds}
						label="Show assistant stats under replies"
					/>
				</div>
				{statsNerds ? (
					<div className="stats-preview" aria-hidden="true">
						<p className="stats-preview__reply">
							Here&apos;s a quick answer to your question…
						</p>
						<p className="stats-preview__meta">
							<Gauge size={12} aria-hidden="true" /> 81.82 tok/sec{"  "}
							<Stack size={12} aria-hidden="true" /> 262 tokens{"  "}
							<Timer size={12} aria-hidden="true" /> Time-to-First: 0.4210 sec
						</p>
					</div>
				) : null}
			</Card>
		</div>
	);
}

/* --- Personalization tab ------------------------------------------------------ */

function PersonalizationTab({
	draft,
	onChange,
}: {
	draft: AiSettings;
	onChange: (patch: Partial<AiSettings>) => void;
}) {
	const [traitDraft, setTraitDraft] = useState("");
	const limit = 12;

	const addTrait = (raw: string) => {
		const trait = raw.trim();
		if (!trait || trait.length > 100 || draft.traits.includes(trait)) return;
		if (draft.traits.length >= limit) return;
		onChange({ traits: [...draft.traits, trait] });
		setTraitDraft("");
	};

	const onTraitKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter" && event.key !== "Tab") return;
		if (!traitDraft.trim()) return;
		event.preventDefault();
		addTrait(traitDraft);
	};

	return (
		<div className="stack">
			<InlineNote>
				Tell the assistant about yourself. Only you see this, and it applies to
				every chat you start.
			</InlineNote>
			<Card>
				<CardHeader
					title="Personalization"
					hint="Traits and context that shape every reply."
				/>
				<div className="card__body stack--sm">
					<div className="form-grid-2">
						<TextField
							label="What should the AI call you?"
							value={draft.display_name}
							onChange={(value) => onChange({ display_name: value })}
							placeholder="What should the AI call you?…"
						/>
						<TextField
							label="Occupation"
							value={draft.occupation}
							onChange={(value) => onChange({ occupation: value })}
							placeholder="Occupation…"
						/>
					</div>

					<div className="field">
						<span className="field__label">How should it respond?</span>
						<div className="traits">
							{draft.traits.map((trait) => (
								<button
									key={trait}
									type="button"
									className="trait-chip trait-chip--on"
									onClick={() =>
										onChange({
											traits: draft.traits.filter((entry) => entry !== trait),
										})
									}
									title="Remove trait"
								>
									{trait} <X size={11} weight="bold" aria-hidden="true" />
								</button>
							))}
							<input
								className="input input--bare trait-input"
								value={traitDraft}
								onChange={(event) => setTraitDraft(event.target.value)}
								onKeyDown={onTraitKeyDown}
								onBlur={() => traitDraft.trim() && addTrait(traitDraft)}
								placeholder="Type a trait and press Enter or Tab…"
								aria-label="Add a trait"
								maxLength={100}
							/>
						</div>
					</div>

					<TextArea
						label="Anything else it should know"
						value={draft.notes}
						onChange={(value) => onChange({ notes: value })}
						placeholder="Interests, values, or preferences to keep in mind"
						rows={5}
						maxLength={3000}
					/>
				</div>
			</Card>
		</div>
	);
}

/* --- Providers tab: connect once, then manage models ------------------------- */

/**
 * A preset is a name plus a base URL, so setup starts filled in instead of
 * blank. The key still goes through the backend's verification before anything
 * is written, so a preset is convenience, never a trust shortcut.
 */
const PROVIDER_PRESETS: {
	key: string;
	name: string;
	baseUrl: string;
	hint: string;
}[] = [
	{
		key: "openai",
		name: "OpenAI",
		baseUrl: "https://api.openai.com/v1",
		hint: "GPT models",
	},
	{
		key: "anthropic",
		name: "Anthropic",
		baseUrl: "https://api.anthropic.com/v1",
		hint: "Claude models",
	},
	{
		key: "gemini",
		name: "Gemini",
		baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
		hint: "Google Gemini",
	},
	{
		key: "grok",
		name: "Grok",
		baseUrl: "https://api.x.ai/v1",
		hint: "xAI Grok",
	},
	{
		key: "mistral",
		name: "Mistral",
		baseUrl: "https://api.mistral.ai/v1",
		hint: "Mistral models",
	},
	{
		// Nothing filled in: the admin names and points their own endpoint.
		key: "others",
		name: "",
		baseUrl: "",
		hint: "Any OpenAI-compatible endpoint",
	},
];

/** The pill on a provider row: can chat use it right now, and if not, why. */
function providerStatus(provider: AiProvider): {
	label: string;
	tone: "success" | "warning" | "error" | "neutral";
	detail?: string;
} {
	if (!provider.has_key) {
		return {
			label: "No key",
			tone: "warning",
			detail: "Paste a key to start this provider.",
		};
	}
	if (!provider.is_enabled) {
		return {
			label: "Disabled",
			tone: "neutral",
			detail:
				provider.health !== "" && provider.health !== "ok"
					? provider.health_detail
					: "Switched off: chat skips this provider until you turn it back on.",
		};
	}
	switch (provider.health) {
		case "ok":
			return provider.enabled_model_count > 0
				? {
						label: `Ready · ${provider.enabled_model_count} ${
							provider.enabled_model_count === 1 ? "model" : "models"
						}`,
						tone: "success",
					}
				: {
						label: "No models on",
						tone: "warning",
						detail: "Switch on at least one model below.",
					};
		case "invalid_key":
			return {
				label: "Invalid key",
				tone: "error",
				detail: provider.health_detail,
			};
		case "endpoint_missing":
			return {
				label: "Wrong base URL",
				tone: "error",
				detail: provider.health_detail,
			};
		case "unreachable":
			return {
				label: "Unreachable",
				tone: "error",
				detail: provider.health_detail,
			};
		case "timeout":
			return {
				label: "Timed out",
				tone: "error",
				detail: provider.health_detail,
			};
		case "rate_limited":
			return {
				label: "Rate limited",
				tone: "warning",
				detail: provider.health_detail,
			};
		case "no_models":
			return {
				label: "No models",
				tone: "warning",
				detail: provider.health_detail,
			};
		default:
			return {
				label: provider.is_enabled ? "Not verified" : "Disabled",
				tone: "neutral",
				detail: "Run a connection test to check this key.",
			};
	}
}

/** The short name of a verification outcome, for toasts. */
function healthLabel(code: ProviderHealth): string {
	switch (code) {
		case "ok":
			return "Ready";
		case "invalid_key":
			return "Invalid key";
		case "endpoint_missing":
			return "Wrong base URL";
		case "unreachable":
			return "Unreachable";
		case "timeout":
			return "Timed out";
		case "rate_limited":
			return "Rate limited";
		case "no_models":
			return "No models";
		default:
			return "Not verified";
	}
}

/**
 * One inline explanation for a refused key, wherever it was typed. The message
 * comes from the backend's classification (bad key, wrong URL, timeout), so the
 * next step is in the text rather than in a support ticket.
 */
function KeyProblem({
	problem,
	onSaveAnyway,
	saving,
}: {
	problem: { code?: ProviderHealth; message: string };
	onSaveAnyway?: () => void;
	saving?: boolean;
}) {
	return (
		<div className="key-problem" role="alert">
			<WarningCircle size={16} weight="fill" aria-hidden="true" />
			<div className="key-problem__body">
				<p className="key-problem__message">{problem.message}</p>
				{onSaveAnyway && problem.code !== "invalid_key" ? (
					<button
						type="button"
						className="link-button"
						disabled={saving}
						onClick={onSaveAnyway}
					>
						Save without verifying
					</button>
				) : null}
			</div>
		</div>
	);
}

function SaveKeyField({
	provider,
	userId,
	onDone,
}: {
	provider: AiProvider;
	userId: string;
	onDone: () => void;
}) {
	const { saveKey } = useAiProviderMutations(userId);
	const [apiKey, setApiKey] = useState("");
	const [problem, setProblem] = useState<{
		code?: ProviderHealth;
		message: string;
	} | null>(null);

	const save = async (allowUnverified = false) => {
		setProblem(null);
		try {
			const result = await saveKey.mutateAsync({
				providerId: provider.id,
				apiKey: apiKey.trim(),
				allowUnverified,
			});
			toastSuccess(
				"Key saved",
				result.enabled_model_count > 0
					? `${result.enabled_model_count} of ${result.model_count} models on`
					: `${result.model_count} models discovered`,
			);
			setApiKey("");
			onDone();
		} catch (caught) {
			// The old key is still stored: say so, because that is the point.
			setProblem({
				code: providerErrorCode(caught),
				message: errorMessage(caught),
			});
		}
	};

	return (
		<div className="provider-key">
			<span className="provider-key__label">
				{provider.has_key ? "Replace key" : "API key"}
			</span>
			<div className="provider-key__row">
				<input
					className="input"
					type="password"
					value={apiKey}
					onChange={(event) => setApiKey(event.target.value)}
					placeholder={
						provider.has_key
							? "•••••••• stored. A new key is checked before it replaces it"
							: "Paste the provider key"
					}
					aria-label={`API key for ${provider.name}`}
					autoComplete="off"
				/>
				<Button
					size="sm"
					disabled={apiKey.trim() === "" || saveKey.isPending}
					onClick={() => void save()}
				>
					{saveKey.isPending ? (
						<CircleNotch
							size={14}
							weight="bold"
							className="spinner"
							aria-hidden="true"
						/>
					) : null}
					{saveKey.isPending ? "Checking…" : "Save key"}
				</Button>
			</div>
			{problem ? (
				<KeyProblem
					problem={problem}
					saving={saveKey.isPending}
					onSaveAnyway={() => void save(true)}
				/>
			) : null}
		</div>
	);
}

/** The catalogue under a provider: search, bulk actions, one default. */
function ProviderModels({
	provider,
	userId,
}: {
	provider: AiProvider;
	userId: string;
}) {
	const models = useProviderModels(provider.id, userId);
	const { updateModel, bulkModels } = useAiProviderMutations(userId);
	const [filter, setFilter] = useState("");

	const items = models.data?.items ?? [];
	const needle = filter.trim().toLowerCase();
	const visible = needle
		? items.filter((model) => model.model_id.toLowerCase().includes(needle))
		: items;
	const busy = bulkModels.isPending || updateModel.isPending;

	const runBulk = (
		action: "enable_all" | "disable_all" | "enable_recommended",
	) => {
		bulkModels.mutate(
			{ providerId: provider.id, action },
			{
				onError: (error) =>
					toastApiError(error, "The models could not be updated"),
			},
		);
	};

	return (
		<div className="models-block__body">
			<div className="model-actions">
				<input
					className="input"
					type="search"
					value={filter}
					onChange={(event) => setFilter(event.target.value)}
					placeholder={`Filter ${items.length} models…`}
					aria-label={`Filter models of ${provider.name}`}
				/>
				<Button
					size="sm"
					variant="secondary"
					disabled={busy}
					onClick={() => runBulk("enable_recommended")}
				>
					Enable recommended
				</Button>
				<Button
					size="sm"
					variant="ghost"
					disabled={busy}
					onClick={() => runBulk("enable_all")}
				>
					Enable all
				</Button>
				<Button
					size="sm"
					variant="ghost"
					disabled={busy}
					onClick={() => runBulk("disable_all")}
				>
					Disable all
				</Button>
			</div>

			{models.isError ? (
				<ErrorState
					title="Models could not be loaded"
					message={errorMessage(models.error)}
					onRetry={() => void models.refetch()}
				/>
			) : items.length === 0 ? (
				<p className="models-block__empty">
					No models stored yet. Save the key to discover them.
				</p>
			) : (
				<div className="model-list">
					{visible.length === 0 ? (
						<p className="models-block__empty">Nothing matches “{filter}”.</p>
					) : (
						visible.map((model) => (
							<div key={model.id} className="model-row">
								<label className="model-row__name">
									<input
										type="checkbox"
										checked={model.is_enabled}
										onChange={(event) =>
											updateModel.mutate({
												providerId: provider.id,
												modelId: model.id,
												isEnabled: event.target.checked,
											})
										}
									/>
									<span className="num">{model.model_id}</span>
								</label>
								{provider.default_model === model.model_id ? (
									<Badge tone="primary">Default</Badge>
								) : (
									<button
										type="button"
										className="link-button"
										disabled={!model.is_enabled}
										onClick={() =>
											updateModel.mutate({
												providerId: provider.id,
												modelId: model.id,
												isDefault: true,
											})
										}
									>
										Set default
									</button>
								)}
							</div>
						))
					)}
				</div>
			)}
		</div>
	);
}

function ProviderCard({
	provider,
	userId,
	onDelete,
}: {
	provider: AiProvider;
	userId: string;
	onDelete: () => void;
}) {
	const [keyOpen, setKeyOpen] = useState(false);
	// A provider with nothing switched on opens its catalogue: that is the one
	// thing left to do, so it should not be hidden behind a disclosure.
	const [modelsOpen, setModelsOpen] = useState(
		provider.enabled_model_count === 0,
	);
	const { toggleProvider, testProvider } = useAiProviderMutations(userId);
	const status = providerStatus(provider);

	return (
		<Card>
			<CardHeader
				title={
					<span className="provider-card__title">
						{provider.name}
						<Badge tone={status.tone}>{status.label}</Badge>
					</span>
				}
				icon={<GearSix size={16} weight="regular" aria-hidden="true" />}
				actions={
					<span className="provider-card__actions">
						<Switch
							checked={provider.is_enabled}
							onChange={(checked) =>
								toggleProvider.mutate(
									{ providerId: provider.id, isEnabled: checked },
									{
										onError: (error) =>
											toastApiError(error, "Provider could not be updated"),
									},
								)
							}
							label={`${provider.is_enabled ? "Disable" : "Enable"} ${provider.name}`}
						/>
						<IconButton
							label={`Delete ${provider.name}`}
							icon={<Trash size={14} weight="regular" aria-hidden="true" />}
							onClick={onDelete}
							tone="danger"
						/>
					</span>
				}
			/>

			<div className="card__body stack--sm">
				<p className="provider-card__url num">
					{provider.base_url} <CopyButton text={provider.base_url} />
				</p>

				{status.detail || provider.checked_at ? (
					<div className="provider-card__status">
						{status.detail ? (
							<span className="provider-card__detail">{status.detail}</span>
						) : null}
						{provider.checked_at ? (
							<span className="provider-card__checked">
								Checked {formatRelative(provider.checked_at)}
							</span>
						) : null}
					</div>
				) : null}

				<p className="provider-card__flags">
					{provider.has_key ? (
						<span className="provider-card__default">
							Key <span className="num">{provider.key_hint ?? "saved"}</span>
						</span>
					) : (
						<Badge tone="warning">No key</Badge>
					)}
					{provider.default_model ? (
						<span className="provider-card__default">
							Default model:{" "}
							<span className="num">{provider.default_model}</span>
						</span>
					) : null}
				</p>

				<div className="provider-card__tools">
					<Button
						size="sm"
						variant="secondary"
						disabled={testProvider.isPending || !provider.has_key}
						onClick={() =>
							testProvider.mutate(provider.id, {
								onSuccess: (result) => {
									if (result.ok) {
										toastSuccess(
											`${provider.name} answered`,
											`${result.enabled_model_count} of ${result.model_count} models on`,
										);
										return;
									}
									toastError(
										`${provider.name}: ${healthLabel(result.code)}`,
										result.message,
									);
								},
								onError: (error) =>
									toastApiError(error, "The connection could not be tested"),
							})
						}
					>
						{testProvider.isPending ? (
							<CircleNotch
								size={14}
								weight="bold"
								className="spinner"
								aria-hidden="true"
							/>
						) : (
							<ArrowClockwise size={14} weight="bold" aria-hidden="true" />
						)}
						{testProvider.isPending ? "Testing…" : "Test connection"}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => setKeyOpen((open) => !open)}
						aria-expanded={keyOpen}
					>
						<Key size={14} weight="regular" aria-hidden="true" />
						{provider.has_key ? "Rotate key" : "Add key"}
					</Button>
				</div>

				{keyOpen ? (
					<SaveKeyField
						provider={provider}
						userId={userId}
						onDone={() => setKeyOpen(false)}
					/>
				) : null}

				<div className="models-block">
					<button
						type="button"
						className="models-block__toggle"
						aria-expanded={modelsOpen}
						onClick={() => setModelsOpen((value) => !value)}
					>
						<span aria-hidden="true">{modelsOpen ? "▾" : "›"}</span>
						Models ({provider.enabled_model_count} of {provider.model_count} on)
					</button>
					{modelsOpen ? (
						<ProviderModels provider={provider} userId={userId} />
					) : null}
				</div>
			</div>
		</Card>
	);
}

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	return (
		<button
			type="button"
			className="copy-btn"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(text);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				} catch {
					// Clipboard can be denied; nothing to recover.
				}
			}}
			aria-label="Copy endpoint"
		>
			{copied ? (
				<Check size={13} weight="bold" aria-hidden="true" />
			) : (
				<Copy size={13} weight="regular" aria-hidden="true" />
			)}
		</button>
	);
}

/**
 * Setup on one screen: pick a preset or type the endpoint, paste the key, and
 * press one button. The backend verifies the key, discovers the models and
 * switches on a starter set, so there is no second screen of toggles.
 */
function ConnectProviderDialog({
	scope,
	userId,
	onClose,
}: {
	scope: "institutional" | "personal";
	userId: string;
	onClose: () => void;
}) {
	const { connectProvider } = useAiProviderMutations(userId);
	const [preset, setPreset] = useState(PROVIDER_PRESETS[0].key);
	const [name, setName] = useState(PROVIDER_PRESETS[0].name);
	const [baseUrl, setBaseUrl] = useState(PROVIDER_PRESETS[0].baseUrl);
	const [apiKey, setApiKey] = useState("");
	const [problem, setProblem] = useState<{
		code?: ProviderHealth;
		message: string;
	} | null>(null);

	const choosePreset = (entry: (typeof PROVIDER_PRESETS)[number]) => {
		// Clicking the preset already chosen is not a change: keep the key.
		if (entry.key === preset) return;
		setPreset(entry.key);
		setName(entry.name);
		setBaseUrl(entry.baseUrl);
		// A key typed for one provider does not belong to the next one, so
		// switching provider clears both the key and the failure it caused.
		setApiKey("");
		setProblem(null);
	};

	const connect = async (allowUnverified = false) => {
		setProblem(null);
		try {
			const result = await connectProvider.mutateAsync({
				scope,
				name: name.trim(),
				baseUrl: baseUrl.trim(),
				apiKey: apiKey.trim(),
				preset,
				allowUnverified,
			});
			const on = result.provider.enabled_model_count;
			toastSuccess(
				`${result.provider.name} connected`,
				result.default_model
					? `${on} ${on === 1 ? "model" : "models"} on · default ${result.default_model}`
					: `${result.provider.model_count} models found`,
			);
			onClose();
		} catch (caught) {
			setProblem({
				code: providerErrorCode(caught),
				message: errorMessage(caught),
			});
		}
	};

	return (
		<Dialog
			title={
				scope === "institutional"
					? "Connect an AI provider"
					: "Connect your provider"
			}
			description="Everything in one step: the key is checked against the endpoint, its models are discovered, and a fast default is switched on — no second screen of model toggles."
			onDismiss={onClose}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button
						variant="primary"
						disabled={connectProvider.isPending || baseUrl.trim() === ""}
						onClick={() => void connect()}
					>
						{connectProvider.isPending ? (
							<CircleNotch
								size={14}
								weight="bold"
								className="spinner"
								aria-hidden="true"
							/>
						) : null}
						{connectProvider.isPending ? "Checking…" : "Connect & discover"}
					</Button>
				</>
			}
		>
			<div className="stack--sm">
				<div
					className="provider-presets"
					role="group"
					aria-label="Provider presets"
				>
					{PROVIDER_PRESETS.map((entry) => (
						<button
							key={entry.key}
							type="button"
							className={
								entry.key === preset
									? "provider-preset provider-preset--on"
									: "provider-preset"
							}
							aria-pressed={entry.key === preset}
							onClick={() => choosePreset(entry)}
						>
							<span className="provider-preset__name">{entry.name}</span>
							<span className="provider-preset__hint">{entry.hint}</span>
						</button>
					))}
				</div>

				<TextField
					label="Name"
					value={name}
					onChange={setName}
					placeholder="e.g. School gateway"
				/>
				<TextField
					label="Base URL"
					value={baseUrl}
					onChange={setBaseUrl}
					placeholder="https://api.example.com/v1"
				/>

				<TextField
					label="API key"
					type="password"
					value={apiKey}
					onChange={setApiKey}
					placeholder="sk-…"
					hint="Encrypted at rest and never returned to the browser. Nothing is stored until the endpoint accepts it."
				/>

				{problem ? (
					<KeyProblem
						problem={problem}
						saving={connectProvider.isPending}
						onSaveAnyway={() => void connect(true)}
					/>
				) : null}
			</div>
		</Dialog>
	);
}

function ProvidersTab({
	userId,
	canConfigure,
}: {
	userId: string;
	canConfigure: boolean;
}) {
	const scope = canConfigure ? "institutional" : "personal";
	const providers = useAiProviderList(userId, scope);
	const { deleteProvider } = useAiProviderMutations(userId);
	const [adding, setAdding] = useState(false);
	const [pendingDelete, setPendingDelete] = useState<AiProvider | null>(null);

	return (
		<div className="stack">
			<div className="assistant-tab-head">
				<div>
					<h2 className="assistant-tab-heading">AI providers</h2>
					<p className="assistant-tab-heading__desc">
						{canConfigure
							? "Institutional OpenAI-compatible endpoints, shared with everyone the school serves."
							: "Your own OpenAI-compatible endpoint. Chats you start with it stay yours."}
					</p>
				</div>
				<Button variant="primary" onClick={() => setAdding(true)}>
					<Plus size={14} weight="bold" aria-hidden="true" />
					Connect provider
				</Button>
			</div>

			{providers.isPending ? (
				<Card>
					<div className="card__body">
						<p className="models-block__empty">
							<CircleNotch
								size={14}
								weight="bold"
								className="spinner"
								aria-hidden="true"
							/>{" "}
							Loading providers…
						</p>
					</div>
				</Card>
			) : providers.isError ? (
				<ErrorState
					title="Providers could not be loaded"
					message={errorMessage(providers.error)}
					onRetry={() => void providers.refetch()}
				/>
			) : (providers.data?.items ?? []).length === 0 ? (
				<Card>
					<EmptyState
						icon={canConfigure ? Buildings : User}
						title={
							canConfigure
								? "No institutional providers"
								: "No personal provider"
						}
						description={
							canConfigure
								? "Pick a provider — OpenAI, Anthropic, Gemini, Grok, Mistral or your own endpoint — paste the key once, and the models are discovered and switched on for you."
								: "Connect your own endpoint: the key is verified, the models appear, and a sensible default is switched on."
						}
						action={
							<Button variant="primary" onClick={() => setAdding(true)}>
								<Plus size={14} weight="bold" aria-hidden="true" />
								Connect provider
							</Button>
						}
					/>
				</Card>
			) : (
				<div className="stack">
					{(providers.data?.items ?? []).map((provider) => (
						<ProviderCard
							key={provider.id}
							provider={provider}
							userId={userId}
							onDelete={() => setPendingDelete(provider)}
						/>
					))}
				</div>
			)}

			{adding ? (
				<ConnectProviderDialog
					scope={scope}
					userId={userId}
					onClose={() => setAdding(false)}
				/>
			) : null}

			{pendingDelete ? (
				<ConfirmDialog
					title={`Delete ${pendingDelete.name}?`}
					description="The stored key is wiped and the provider stops serving chats immediately."
					confirmLabel="Delete provider"
					successMessage={`${pendingDelete.name} deleted`}
					onConfirm={() => deleteProvider.mutateAsync(pendingDelete.id)}
					onClose={() => setPendingDelete(null)}
				/>
			) : null}
		</div>
	);
}

/* --- MCP tab: the apps the assistant can act through ------------------------ */

/* --- MCP tab: the servers the assistant acts through ------------------------ */

/** Which module each tool writes through, in the order the tab lists them. */
const MCP_MODULE_ORDER = [
	"subjects",
	"lectures",
	"assignments",
	"quizzes",
	"flashcards",
	"forums",
];

const MCP_MODULE_LABELS: Record<string, string> = {
	subjects: "Subjects and weeks",
	lectures: "Lectures",
	assignments: "Assignments",
	quizzes: "Quizzes",
	flashcards: "Flashcards",
	forums: "Forums",
};

function groupToolsByModule(tools: McpTool[]): [string, McpTool[]][] {
	const grouped = new Map<string, McpTool[]>();
	for (const tool of tools) {
		const list = grouped.get(tool.module);
		if (list) list.push(tool);
		else grouped.set(tool.module, [tool]);
	}
	return [...grouped.entries()].sort(
		(a, b) => MCP_MODULE_ORDER.indexOf(a[0]) - MCP_MODULE_ORDER.indexOf(b[0]),
	);
}

/**
 * The built-in server: this backend's own create actions, exposed over MCP at
 * POST /api/mcp. Connecting it is what lets the assistant write; the tool list
 * is answered per permission, so what is greyed out here is exactly what the
 * account cannot do on a screen either.
 */
function OptimoLmsServerCard({ userId }: { userId: string }) {
	const server = useMcpServerTools(userId);
	const connect = useConnectMcpApp(userId);
	const disconnect = useDisconnectMcpApp(userId);
	const connected = server.data?.connected ?? false;
	const busy = connect.isPending || disconnect.isPending;

	const toggle = () => {
		const request = connected
			? disconnect.mutateAsync("optimolms")
			: connect.mutateAsync("optimolms");
		void toast.promise(request, {
			loading: connected ? "Disconnecting OptimoLMS…" : "Connecting OptimoLMS…",
			success: connected
				? "OptimoLMS disconnected — the assistant can no longer create content"
				: "OptimoLMS connected — the assistant can now create content",
			error: (caught) => errorMessage(caught),
		});
	};

	const tools = server.data?.tools ?? [];
	const groups = groupToolsByModule(tools);

	return (
		<Card>
			<CardHeader
				title={
					<span className="provider-card__title">
						OptimoLMS
						<Badge tone={connected ? "success" : "outline"}>
							{connected ? "Connected" : "Not connected"}
						</Badge>
					</span>
				}
				hint="Built-in MCP server"
				icon={<PlugsConnected size={16} weight="regular" aria-hidden="true" />}
				actions={
					<Button
						variant={connected ? "ghost" : "primary"}
						size="sm"
						onClick={toggle}
						disabled={busy || server.isPending}
						icon={
							busy ? (
								<CircleNotch
									size={14}
									weight="bold"
									className="spinner"
									aria-hidden="true"
								/>
							) : (
								<Plugs size={14} weight="regular" aria-hidden="true" />
							)
						}
					>
						{connected ? "Disconnect" : "Connect"}
					</Button>
				}
			/>

			<div className="card__body stack--sm">
				<p className="provider-card__url num">
					<span className="mcp-method">POST</span>{" "}
					{server.data?.endpoint ?? "/api/mcp"}{" "}
					<CopyButton
						text={`${window.location.origin}${server.data?.endpoint ?? "/api/mcp"}`}
					/>
				</p>
				<p className="provider-card__flags">
					<code className="mcp-scope">
						{server.data?.protocol ?? "2025-06-18"}
					</code>
					<span className="provider-card__default">
						JSON-RPC 2.0 over HTTP, so any MCP client can drive the same actions
					</span>
				</p>

				{server.isPending ? (
					<SkeletonStack rows={4} />
				) : server.isError ? (
					<ErrorState
						title="The MCP server could not be read"
						message={errorMessage(server.error)}
						onRetry={() => void server.refetch()}
					/>
				) : (
					<>
						<div className="mcp-heading">
							<span className="mcp-heading__title">
								Tools
								<Badge tone="outline">
									{server.data?.allowed ?? 0} of {server.data?.total ?? 0}{" "}
									available
								</Badge>
							</span>
						</div>
						{!connected ? (
							<InlineNote>
								Connect OptimoLMS and the assistant can create subjects, weeks,
								lectures, assignments, quizzes, flashcards and forum threads for
								you. Until then it only answers questions.
							</InlineNote>
						) : null}

						{groups.map(([module, list]) => (
							<div key={module} className="mcp-tool-group">
								<p className="mcp-tool-group__title">
									{MCP_MODULE_LABELS[module] ?? humanize(module)}
								</p>
								<ul className="mcp-tool-list">
									{list.map((tool) => (
										<li
											key={tool.name}
											className={
												tool.available
													? "mcp-tool"
													: "mcp-tool mcp-tool--locked"
											}
										>
											<div className="mcp-tool__text">
												<p className="mcp-tool__name">
													{tool.title}
													<code className="mcp-tool__id">{tool.name}</code>
												</p>
												<p className="mcp-tool__desc">{tool.description}</p>
											</div>
											<Badge tone={tool.available ? "outline" : "warning"}>
												{tool.available
													? tool.permission
													: `needs ${tool.permission}`}
											</Badge>
										</li>
									))}
								</ul>
							</div>
						))}
					</>
				)}
			</div>

			<footer className="card__footer mcp-footnote">
				A tool runs as you, inside your permissions — the assistant cannot
				create anything your account could not create by hand.
			</footer>
		</Card>
	);
}

function McpTab({ userId }: { userId: string }) {
	return (
		<div className="stack">
			<h2 className="assistant-tab-heading">MCP</h2>
			<p className="assistant-tab-heading__desc">
				Servers the assistant can act through. OptimoLMS ships its own: the
				backend&apos;s create actions, offered as MCP tools. The assistant uses
				only what you connect, and only inside your permissions.
			</p>
			<OptimoLmsServerCard userId={userId} />
			<McpAppsPanel
				userId={userId}
				title="Other apps"
				hint="Third-party services from the catalog"
			/>
		</div>
	);
}

/* --- Page ------------------------------------------------------------------ */

function AssistantPage() {
	const { session } = useAuth();
	const { canConfigure } = useAssistantAccess();
	const [tab, setTab] = useState<AssistantTab>("general");
	const settings = useAiSettings(session?.user.id);
	const saveSettings = useUpdateAiSettings(session?.user.id);
	const [draft, setDraft] = useState<AiSettings | null>(null);
	const serverSignature = settings.data?.updated_at ?? "";
	const lastServerSignature = useRef(serverSignature);

	useEffect(() => {
		if (!settings.data) return;
		if (lastServerSignature.current !== serverSignature) {
			lastServerSignature.current = serverSignature;
			setDraft(settings.data);
		} else if (draft === null) {
			setDraft(settings.data);
		}
	}, [serverSignature, settings.data, draft]);

	if (!session) return null;

	const patch = (patchUpdate: Partial<AiSettings>) => {
		setDraft((current) => (current ? { ...current, ...patchUpdate } : current));
	};

	const dirty =
		draft !== null &&
		settings.data !== undefined &&
		(draft.assistant_name !== settings.data.assistant_name ||
			draft.system_prompt !== settings.data.system_prompt ||
			draft.display_name !== settings.data.display_name ||
			draft.occupation !== settings.data.occupation ||
			JSON.stringify(draft.traits) !== JSON.stringify(settings.data.traits) ||
			draft.notes !== settings.data.notes ||
			(draft.max_output_tokens ?? 0) !==
				(settings.data.max_output_tokens ?? 0));

	return (
		<>
			<PageHeader
				title="AI assistant"
				description="How the assistant presents itself, what it knows about you, which providers power it and which apps it can act through."
			/>

			<div
				className="assistant-tabs"
				role="tablist"
				aria-label="Assistant settings"
			>
				{TABS.map((entry) => (
					<button
						key={entry.key}
						type="button"
						role="tab"
						aria-selected={entry.key === tab}
						className={
							entry.key === tab
								? "assistant-tab assistant-tab--active"
								: "assistant-tab"
						}
						onClick={() => setTab(entry.key)}
					>
						{entry.label}
					</button>
				))}
			</div>

			<div className="assistant-body stack">
				{tab === "general" ? (
					draft ? (
						<GeneralTab draft={draft} onChange={patch} />
					) : (
						<Card>
							<div className="card__body">
								<p className="models-block__empty">
									<CircleNotch
										size={14}
										weight="bold"
										className="spinner"
										aria-hidden="true"
									/>{" "}
									Loading assistant settings…
								</p>
							</div>
						</Card>
					)
				) : null}

				{tab === "personalization" ? (
					draft ? (
						<PersonalizationTab draft={draft} onChange={patch} />
					) : null
				) : null}

				{tab === "providers" ? (
					<ProvidersTab userId={session.user.id} canConfigure={canConfigure} />
				) : null}

				{tab === "mcp" ? <McpTab userId={session.user.id} /> : null}
			</div>

			{(tab === "general" || tab === "personalization") && draft ? (
				<div
					className={
						dirty || saveSettings.isPending
							? "save-bar save-bar--shown"
							: "save-bar"
					}
					role="region"
					aria-label="Unsaved changes"
					inert={!dirty && !saveSettings.isPending}
				>
					<span className="save-bar__text">
						<span className="save-bar__dot" aria-hidden="true" />
						You have unsaved changes
					</span>
					<Button
						variant="ghost"
						size="sm"
						disabled={saveSettings.isPending}
						onClick={() => settings.data && setDraft(settings.data)}
					>
						Discard
					</Button>
					<Button
						variant="primary"
						size="sm"
						onClick={() =>
							saveSettings.mutate(draft, {
								onSuccess: () => toastSuccess("Assistant preferences saved"),
								onError: (error) =>
									toastApiError(error, "Preferences could not be saved"),
							})
						}
						disabled={!dirty || saveSettings.isPending}
						icon={
							saveSettings.isPending ? (
								<CircleNotch
									size={14}
									weight="bold"
									className="spinner"
									aria-hidden="true"
								/>
							) : null
						}
					>
						Save changes
					</Button>
				</div>
			) : null}
		</>
	);
}

export const assistantRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/assistant",
	component: AssistantPage,
});
