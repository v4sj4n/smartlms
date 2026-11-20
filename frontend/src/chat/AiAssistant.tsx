import { useChat } from "@ai-sdk/react";
import {
	ArrowCounterClockwise,
	ArrowDown,
	ArrowElbowDownLeft,
	ArrowRight,
	ArrowsOutSimple,
	BookOpenText,
	CaretLeft,
	CaretRight,
	Check,
	CircleNotch,
	Copy,
	Exam,
	PencilSimple,
	Plus,
	Sparkle,
	Square,
	WarningCircle,
	X,
} from "@phosphor-icons/react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
	type KeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { type AiChatProvider, api } from "../api";
import { useAuth } from "../auth";
import { toast } from "../toast";
import { getChatMaterial, useChatMaterial } from "./context";
import { HistoryMenu, RecentChats } from "./HistoryMenu";
import { Markdown } from "./Markdown";
import { MessageStats } from "./MessageStats";
import { ModelMenu } from "./ModelMenu";
import { statsOf, useStatsForNerds } from "./preferences";
import { Thinking } from "./Thinking";
import { useAssistantName } from "./useAssistantChat";

/** The model picked in the composer, per browser. */
const MODEL_KEY = "smartlms.ai.model";
/** Distance from the bottom (px) that still counts as "following" the reply. */
const FOLLOW_SLACK = 48;

function messageText(message: UIMessage): string {
	return message.parts
		.map((part) => (part.type === "text" ? part.text : ""))
		.join("");
}

/* --- MCP tool calls ---------------------------------------------------------
 * A reply can do as well as say: the backend's MCP tools (create subject, week,
 * lecture, assignment, quiz, flashcards, forum thread) arrive as tool parts
 * with a state of their own. Each one is one line: what it did, and whether it
 * worked, so nobody has to read JSON to see the assistant created something.
 */

type ToolView = {
	key: string;
	name: string;
	state: string;
	output?: unknown;
	errorText?: string;
};

type ToolPartLike = {
	type: string;
	toolName?: string;
	toolCallId?: string;
	state?: string;
	input?: unknown;
	output?: unknown;
	errorText?: string;
};

function toolViewsOf(message: UIMessage): ToolView[] {
	const views: ToolView[] = [];
	message.parts.forEach((raw, index) => {
		const part = raw as unknown as ToolPartLike;
		if (part.type !== "dynamic-tool" && !part.type.startsWith("tool-")) return;
		const name = part.toolName ?? part.type.slice("tool-".length);
		views.push({
			key: part.toolCallId ?? `${name}-${index}`,
			name,
			state: part.state ?? "",
			output: part.output,
			errorText: part.errorText,
		});
	});
	return views;
}

const TOOL_LABELS: Record<string, string> = {
	list_subjects: "Reading the subject list",
	create_subject: "Created a subject",
	list_weeks: "Reading the course weeks",
	create_week: "Added a course week",
	create_lecture: "Added a lecture",
	create_assignment: "Created an assignment",
	create_quiz: "Created a quiz",
	add_quiz_question: "Added a quiz question",
	create_flashcards: "Added flashcards",
	create_forum_thread: "Started a forum thread",
	post_forum_reply: "Replied in the forum",
};

function toolDetail(tool: ToolView): string {
	const output = tool.output;
	if (output && typeof output === "object") {
		const record = output as Record<string, unknown>;
		for (const field of ["title", "name", "message"]) {
			const value = record[field];
			if (typeof value === "string" && value.trim()) return value.trim();
		}
		const count = record.count;
		if (typeof count === "number") return `${count} item(s)`;
	}
	return "";
}

function ToolCalls({ tools }: { tools: ToolView[] }) {
	if (tools.length === 0) return null;
	return (
		<div className="ai-tools">
			{tools.map((tool) => {
				const failed =
					tool.state === "output-error" || tool.state === "output-denied";
				const running = tool.state !== "output-available" && !failed;
				const detail = failed ? (tool.errorText ?? "failed") : toolDetail(tool);
				return (
					<div
						key={tool.key}
						className={
							failed
								? "ai-tool ai-tool--failed"
								: running
									? "ai-tool ai-tool--running"
									: "ai-tool"
						}
					>
						<span className="ai-tool__icon" aria-hidden="true">
							{failed ? (
								<WarningCircle />
							) : running ? (
								<CircleNotch className="spinner" />
							) : (
								<Check />
							)}
						</span>
						<span className="ai-tool__label">
							{TOOL_LABELS[tool.name] ?? tool.name}
						</span>
						{detail ? <span className="ai-tool__detail">{detail}</span> : null}
					</div>
				);
			})}
		</div>
	);
}

/* --- Versions of a turn ------------------------------------------------------
 * Earlier versions of a turn live on its user message: `tails[k]` is that
 * message plus every reply after it. The shown version's slot is left empty. */

type Branches = { tails: UIMessage[][]; active: number };

function branchesOf(message: UIMessage): Branches | undefined {
	return (message.metadata as { branches?: Branches } | undefined)?.branches;
}

function withBranches(message: UIMessage, branches: Branches): UIMessage {
	const meta = (message.metadata ?? {}) as Record<string, unknown>;
	return { ...message, metadata: { ...meta, branches } };
}

function withoutBranches(message: UIMessage): UIMessage {
	const meta = message.metadata as Record<string, unknown> | undefined;
	if (!meta?.branches) return message;
	const { branches: _drop, ...rest } = meta;
	return { ...message, metadata: rest };
}

/** Saves the shown version and starts a new one at `index` (a user message). */
function forkAt(
	messages: UIMessage[],
	index: number,
	user: UIMessage = messages[index]!,
): UIMessage[] {
	const current = branchesOf(messages[index]!) ?? { tails: [[]], active: 0 };
	const tails = [...current.tails];
	tails[current.active] = [
		withoutBranches(messages[index]!),
		...messages.slice(index + 1),
	];
	tails.push([]);
	return [
		...messages.slice(0, index),
		withBranches(withoutBranches(user), { tails, active: tails.length - 1 }),
	];
}

/** Shows version `target` of the turn starting at `index`. */
function switchAt(
	messages: UIMessage[],
	index: number,
	target: number,
): UIMessage[] {
	const current = branchesOf(messages[index]!);
	if (!current || !current.tails[target]?.length) return messages;
	const tails = [...current.tails];
	tails[current.active] = [
		withoutBranches(messages[index]!),
		...messages.slice(index + 1),
	];
	const [head, ...rest] = tails[target]!;
	tails[target] = [];
	return [
		...messages.slice(0, index),
		withBranches(head!, { tails, active: target }),
		...rest,
	];
}

/** Clipboard API needs a secure context; fall back to execCommand on LAN dev. */
async function copyText(text: string): Promise<boolean> {
	try {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// Permission denied or unfocused document: try the fallback.
	}
	const area = document.createElement("textarea");
	area.value = text;
	area.setAttribute("readonly", "");
	area.style.position = "fixed";
	area.style.opacity = "0";
	document.body.appendChild(area);
	area.select();
	try {
		return document.execCommand("copy");
	} catch {
		return false;
	} finally {
		area.remove();
	}
}

function CopyButton({
	text,
	className = "",
}: {
	text: string;
	className?: string;
}) {
	const [copied, setCopied] = useState(false);
	useEffect(() => {
		if (!copied) return;
		const id = window.setTimeout(() => setCopied(false), 1500);
		return () => window.clearTimeout(id);
	}, [copied]);
	const label = copied ? "Copied" : "Copy";
	return (
		<button
			type="button"
			className={`ai-reply-action ${className}`}
			aria-label={label}
			title={label}
			onClick={() =>
				void copyText(text).then((ok) => {
					if (ok) setCopied(true);
					else toast.error("Couldn’t copy");
				})
			}
		>
			{copied ? (
				<Check aria-hidden="true" className="ai-pop" />
			) : (
				<Copy aria-hidden="true" />
			)}
		</button>
	);
}

function salutation(): string {
	const hour = new Date().getHours();
	return hour < 12
		? "Good morning"
		: hour < 18
			? "Good afternoon"
			: "Good evening";
}

function AiAssistantPanel({
	name,
	page,
	sessionParam,
}: {
	name: string;
	/** Full-page chat at /chat: always open, fills the content area. */
	page: boolean;
	sessionParam?: string;
}) {
	const { session } = useAuth();
	const userId = session?.user.id ?? "";
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const material = useChatMaterial();
	const [openState, setOpen] = useState(false);
	const open = page || openState;
	const [input, setInput] = useState("");
	const [editing, setEditing] = useState<{ id: string; text: string } | null>(
		null,
	);
	const [unread, setUnread] = useState(false);
	const [away, setAway] = useState(false);
	const [sessionId, setSessionIdState] = useState<string | null>(null);
	const [sessionsVersion, setSessionsVersion] = useState(0);
	const [providers, setProviders] = useState<AiChatProvider[]>([]);
	const [modelId, setModelId] = useState<string | null>(null);
	const [showStats] = useStatsForNerds();
	const scrollRef = useRef<HTMLDivElement>(null);
	const composerRef = useRef<HTMLTextAreaElement>(null);
	const openRef = useRef(open);
	openRef.current = open;

	// Read on every send, so page/model changes apply without a new transport.
	const sessionIdRef = useRef<string | null>(null);
	const bodyRef = useRef<Record<string, unknown>>({});
	bodyRef.current = {
		user_id: userId,
		model_id: modelId ?? undefined,
		context: { page: pathname, title: getChatMaterial()?.title ?? "" },
	};

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: "/api/ai/chat",
				body: () => bodyRef.current,
			}),
		[],
	);

	const {
		messages,
		sendMessage,
		status,
		setMessages,
		stop,
		error,
		regenerate,
		clearError,
	} = useChat({
		transport,
		onFinish: ({ messages: finished }) => {
			const id = sessionIdRef.current;
			if (id && userId) {
				void api
					.saveAiSessionMessages(id, userId, finished)
					.then(() => setSessionsVersion((v) => v + 1))
					.catch(() => undefined);
			}
			if (!openRef.current) setUnread(true);
		},
	});

	const busy = status === "submitted" || status === "streaming";
	const empty = messages.length === 0;

	const setSession = (id: string | null) => {
		sessionIdRef.current = id;
		setSessionIdState(id);
	};

	const suggestions = [
		{ icon: Sparkle, text: "What can you help me with?" },
		material
			? { icon: BookOpenText, text: `Summarise “${material.title}” for me` }
			: { icon: BookOpenText, text: "Explain a hard concept from my subjects" },
		{ icon: Exam, text: "Quiz me on what I studied this week" },
	];

	// Follow the reply while the reader is at the bottom; leave them be once they scroll up.
	useEffect(() => {
		const el = scrollRef.current;
		if (!el || away) return;
		el.scrollTop = el.scrollHeight;
	}, [messages, status, open, away]);

	const onScroll = () => {
		const el = scrollRef.current;
		if (!el) return;
		setAway(el.scrollHeight - el.scrollTop - el.clientHeight > FOLLOW_SLACK);
	};

	const follow = () => {
		scrollRef.current?.scrollTo({
			top: scrollRef.current.scrollHeight,
			behavior: "smooth",
		});
		setAway(false);
	};

	// Re-read what's chat-ready each time it opens: settings may have changed.
	useEffect(() => {
		if (!open || !userId) return;
		let cancelled = false;
		api
			.aiChatModels(userId)
			.then((data) => {
				if (cancelled) return;
				setProviders(data.providers);
				const all = data.providers.flatMap((provider) => provider.models);
				let stored: string | null = null;
				try {
					stored = window.localStorage.getItem(MODEL_KEY);
				} catch {
					stored = null;
				}
				setModelId(
					all.some((model) => model.id === stored)
						? stored
						: (data.default_model_id ?? all[0]?.id ?? null),
				);
			})
			.catch(() => {
				if (!cancelled) setProviders([]);
			});
		return () => {
			cancelled = true;
		};
	}, [open, userId]);

	const pickModel = (id: string) => {
		setModelId(id);
		try {
			window.localStorage.setItem(MODEL_KEY, id);
		} catch {
			// Private mode: the pick lasts for this session only.
		}
	};

	useEffect(() => {
		if (!open) return;
		setUnread(false);
		composerRef.current?.focus({ preventScroll: true });
		if (page) return;
		const onKey = (event: globalThis.KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, page]);

	const resizeComposer = () => {
		const el = composerRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, page ? 200 : 120)}px`;
	};

	function newChat() {
		if (busy) void stop();
		clearError();
		setSession(null);
		setMessages([]);
		setAway(false);
		composerRef.current?.focus();
	}

	async function deleteSession(id: string) {
		await api.deleteAiSession(id, userId);
		if (sessionIdRef.current === id) newChat();
		setSessionsVersion((v) => v + 1);
	}

	async function openSession(id: string) {
		if (busy) void stop();
		try {
			const data = await api.aiSession(id, userId);
			clearError();
			setSession(id);
			setMessages((data.messages ?? []) as UIMessage[]);
			setAway(false);
		} catch {
			toast.error("That conversation could not be opened");
		}
	}

	// /chat?session=… continues the chat that was open in the floating panel.
	useEffect(() => {
		if (sessionParam && userId) void openSession(sessionParam);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sessionParam, userId]);

	async function send(raw: string) {
		const text = raw.trim();
		// A failed turn locks the composer until it's retried.
		if (!text || busy || error) return;
		if (!sessionIdRef.current && userId) {
			try {
				const created = await api.createAiSession(userId);
				setSession(created.id);
			} catch {
				// History is a nicety: the chat still works without a saved session.
			}
		}
		setInput("");
		requestAnimationFrame(resizeComposer);
		setAway(false);
		await sendMessage({ text });
	}

	/** Retries a reply, keeping the old one as a version of its turn. */
	function retryReply(index: number) {
		const userIndex = index - 1;
		if (messages[userIndex]?.role !== "user") {
			void regenerate({ messageId: messages[index]!.id });
			return;
		}
		setMessages(forkAt(messages, userIndex));
		setAway(false);
		void regenerate();
	}

	function saveEdit(index: number) {
		const text = editing?.text.trim();
		setEditing(null);
		const original = messages[index]!;
		if (!text || busy || text === messageText(original)) return;
		const edited: UIMessage = {
			...original,
			id: crypto.randomUUID(),
			parts: [{ type: "text", text }],
		};
		setMessages(forkAt(messages, index, edited));
		setAway(false);
		void regenerate();
	}

	function showVersion(index: number, target: number) {
		if (busy) return;
		const next = switchAt(messages, index, target);
		setMessages(next);
		if (sessionIdRef.current) {
			void api
				.saveAiSessionMessages(sessionIdRef.current, userId, next)
				.catch(() => undefined);
		}
	}

	/** ‹ 2/3 › under the last reply of a turn that has several versions. */
	function versionSwitcher(index: number) {
		const branches = branchesOf(messages[index]!);
		if (!branches || branches.tails.length < 2) return null;
		return (
			<div className="ai-versions num">
				<button
					type="button"
					className="ai-reply-action"
					disabled={busy || branches.active === 0}
					onClick={() => showVersion(index, branches.active - 1)}
					aria-label="Previous version"
					title="Previous version"
				>
					<CaretLeft aria-hidden="true" />
				</button>
				<span>
					{branches.active + 1}/{branches.tails.length}
				</span>
				<button
					type="button"
					className="ai-reply-action"
					disabled={busy || branches.active === branches.tails.length - 1}
					onClick={() => showVersion(index, branches.active + 1)}
					aria-label="Next version"
					title="Next version"
				>
					<CaretRight aria-hidden="true" />
				</button>
			</div>
		);
	}

	const onComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key !== "Enter" || event.shiftKey) return;
		event.preventDefault();
		// IME composition (CJK input) also fires Enter.
		if (event.nativeEvent.isComposing || event.keyCode === 229) return;
		void send(input);
	};

	const composer = (
		<form
			className={page ? "ai-composer ai-composer--page" : "ai-composer"}
			onSubmit={(event) => {
				event.preventDefault();
				void send(input);
			}}
		>
			<ModelMenu providers={providers} modelId={modelId} onPick={pickModel} />
			<textarea
				ref={composerRef}
				rows={1}
				value={input}
				disabled={Boolean(error)}
				placeholder={`Message ${name}…`}
				aria-label={`Message ${name}`}
				className="ai-composer__input"
				onChange={(event) => {
					setInput(event.target.value);
					resizeComposer();
				}}
				onKeyDown={onComposerKey}
			/>
			{busy ? (
				<button
					type="button"
					className="ai-send"
					aria-label="Stop generating"
					title="Stop"
					onClick={() => void stop()}
				>
					<Square weight="fill" aria-hidden="true" />
				</button>
			) : error ? (
				<button
					type="button"
					className="ai-send"
					aria-label="Retry the last message"
					title="Retry"
					onClick={() => void regenerate()}
				>
					<ArrowCounterClockwise aria-hidden="true" />
				</button>
			) : (
				<button
					type="submit"
					className="ai-send"
					aria-label="Send message (Enter)"
					title="Send · Enter"
					disabled={!input.trim()}
				>
					<ArrowElbowDownLeft aria-hidden="true" className="ai-send__glyph" />
				</button>
			)}
		</form>
	);

	return (
		<div className={page ? "ai ai--page" : "ai ai--floating"} data-open={open}>
			<section
				role={page ? "region" : "dialog"}
				aria-label={`Chat with ${name}`}
				inert={!open}
				className={open ? "ai-panel ai-panel--open" : "ai-panel"}
			>
				<header className="ai-head">
					<Sparkle
						aria-hidden="true"
						weight="fill"
						className={busy ? "ai-head__mark ai-think" : "ai-head__mark"}
					/>
					<div className="ai-head__text">
						<h2 className="ai-head__title">{name}</h2>
						{material && !page ? (
							<span className="ai-head__context">
								Looking at: {material.title}
							</span>
						) : null}
					</div>
					<div
						className={
							page
								? "ai-head__actions ai-head__actions--page"
								: "ai-head__actions"
						}
					>
						<HistoryMenu
							userId={userId}
							currentId={sessionId}
							version={sessionsVersion}
							onPick={(id) => void openSession(id)}
							onDelete={deleteSession}
						/>
						<button
							type="button"
							className="ai-icon-btn"
							aria-label="New chat"
							title="New chat"
							disabled={empty}
							onClick={newChat}
						>
							<Plus aria-hidden="true" />
						</button>
						{!page ? (
							<>
								<button
									type="button"
									className="ai-icon-btn"
									aria-label="Open in full page"
									title="Open in full page"
									onClick={() => {
										setOpen(false);
										void navigate({
											to: "/chat",
											search: sessionId ? { session: sessionId } : {},
										});
									}}
								>
									<ArrowsOutSimple aria-hidden="true" />
								</button>
								<button
									type="button"
									className="ai-icon-btn ai-icon-btn--danger"
									aria-label="Close"
									title="Close"
									onClick={() => setOpen(false)}
								>
									<X aria-hidden="true" />
								</button>
							</>
						) : null}
					</div>
					<span className="visually-hidden" role="status">
						{busy ? `${name} is replying` : ""}
					</span>
				</header>

				<div className="ai-body">
					<div ref={scrollRef} onScroll={onScroll} className="ai-scroll">
						<div className="ai-log">
							{page && empty ? (
								<div className="ai-hero">
									<div className="ai-hero__title">
										<Sparkle aria-hidden="true" weight="fill" />
										<h3>What’s on the agenda today?</h3>
									</div>
									<div className="ai-hero__composer">{composer}</div>
									<ul className="ai-hero__chips">
										{suggestions.map(({ icon: Icon, text }) => (
											<li key={text}>
												<button
													type="button"
													disabled={busy}
													onClick={() => void send(text)}
												>
													<Icon aria-hidden="true" />
													{text}
												</button>
											</li>
										))}
									</ul>
								</div>
							) : null}

							{!page && empty ? (
								<div className="ai-welcome">
									<div className="ai-welcome__text">
										<h3>{salutation()}.</h3>
										<p>Hi! I’m {name}. How can I help you today?</p>
									</div>
									<ul className="ai-welcome__list">
										{suggestions.map(({ icon: Icon, text }, index) => (
											<li
												key={text}
												style={{ animationDelay: `${120 + index * 60}ms` }}
											>
												<button
													type="button"
													disabled={busy}
													onClick={() => void send(text)}
												>
													<Icon
														aria-hidden="true"
														className="ai-welcome__icon"
													/>
													<span>{text}</span>
													<ArrowRight
														aria-hidden="true"
														className="ai-welcome__arrow"
													/>
												</button>
											</li>
										))}
									</ul>
								</div>
							) : null}

							{messages.map((message, index) => {
								const text = messageText(message);

								if (message.role === "user") {
									const isLastUser = !messages
										.slice(index + 1)
										.some((later) => later.role === "user");
									if (editing?.id === message.id) {
										return (
											<form
												key={message.id}
												className="ai-edit"
												onSubmit={(event) => {
													event.preventDefault();
													saveEdit(index);
												}}
											>
												<textarea
													autoFocus
													rows={3}
													value={editing.text}
													aria-label="Edit message"
													onChange={(event) =>
														setEditing({
															id: message.id,
															text: event.target.value,
														})
													}
													onKeyDown={(event) => {
														if (event.key === "Escape") setEditing(null);
														if (
															event.key === "Enter" &&
															!event.shiftKey &&
															!event.nativeEvent.isComposing
														) {
															event.preventDefault();
															saveEdit(index);
														}
													}}
												/>
												<div className="ai-edit__actions">
													<button
														type="button"
														className="btn btn--secondary btn--sm"
														onClick={() => setEditing(null)}
													>
														Cancel
													</button>
													<button
														type="submit"
														className="btn btn--primary btn--sm"
														disabled={!editing.text.trim()}
													>
														Send
													</button>
												</div>
											</form>
										);
									}
									return (
										<div key={message.id} className="ai-user">
											<p className="ai-user__bubble">{text}</p>
											<div className="ai-user__actions">
												{isLastUser && !busy ? (
													<button
														type="button"
														className="ai-reply-action ai-reveal"
														onClick={() => setEditing({ id: message.id, text })}
														aria-label="Edit message"
														title="Edit message"
													>
														<PencilSimple aria-hidden="true" />
													</button>
												) : null}
												<CopyButton text={text} className="ai-reveal" />
											</div>
										</div>
									);
								}

								const live =
									status === "streaming" && index === messages.length - 1;
								const tools = toolViewsOf(message);
								const thoughts = message.parts.flatMap((part, i) =>
									part.type === "reasoning" && part.text.trim()
										? [
												{
													key: i,
													text: part.text,
													streaming: live && part.state === "streaming",
												},
											]
										: [],
								);
								if (
									!text &&
									!live &&
									thoughts.length === 0 &&
									tools.length === 0
								)
									return null;
								const stats =
									showStats && !live ? statsOf(message.metadata) : undefined;
								const isLast = index === messages.length - 1;
								const turnStart = messages
									.slice(0, index)
									.map((earlier) => earlier.role)
									.lastIndexOf("user");

								return (
									<div key={message.id} className="ai-reply">
										<ToolCalls tools={tools} />
										{thoughts.length > 0 ? (
											<div className="ai-steps">
												{thoughts.map((thought) => (
													<Thinking
														key={thought.key}
														text={thought.text}
														streaming={thought.streaming}
													/>
												))}
											</div>
										) : null}
										{text || (thoughts.length === 0 && tools.length === 0) ? (
											<div className="ai-reply__md">
												<Markdown text={text || "…"} />
											</div>
										) : null}
										{stats ? <MessageStats stats={stats} /> : null}
										{text && !live ? (
											<div className="ai-reply__actions">
												<CopyButton text={text} />
												{!busy && !(error && isLast) ? (
													<button
														type="button"
														onClick={() => retryReply(index)}
														className="ai-reply-action ai-reply-action--spin"
														aria-label="Retry"
														title="Retry"
													>
														<ArrowCounterClockwise aria-hidden="true" />
													</button>
												) : null}
												{turnStart >= 0 &&
												messages[index + 1]?.role !== "assistant"
													? versionSwitcher(turnStart)
													: null}
											</div>
										) : null}
									</div>
								);
							})}

							{error ? (
								<p role="alert" className="ai-error">
									<WarningCircle aria-hidden="true" />
									{error.message || "Something went wrong. Try again."}
								</p>
							) : null}

							{status === "submitted" ? (
								<p aria-hidden="true" className="ai-dots">
									{[0, 150, 300].map((delay) => (
										<span
											key={delay}
											style={{ animationDelay: `${delay}ms` }}
										/>
									))}
								</p>
							) : null}
						</div>
					</div>

					<button
						type="button"
						tabIndex={away ? 0 : -1}
						aria-hidden={!away}
						aria-label={
							busy ? "Follow the live reply" : "Scroll to latest message"
						}
						onClick={follow}
						className={[
							"ai-follow",
							away ? "ai-follow--shown" : "",
							busy ? "ai-follow--live" : "",
						].join(" ")}
					>
						<ArrowDown aria-hidden="true" />
					</button>
				</div>

				{!(page && empty) ? composer : null}
			</section>

			{page ? (
				<RecentChats
					userId={userId}
					currentId={sessionId}
					version={sessionsVersion}
					onPick={(id) => void openSession(id)}
					onNew={newChat}
					canNew={!empty}
				/>
			) : null}

			{!page ? (
				<button
					type="button"
					aria-label={
						unread ? `Chat with ${name} (new reply)` : `Chat with ${name}`
					}
					aria-expanded={open}
					onClick={() => setOpen(true)}
					className={open ? "ai-fab ai-fab--hidden" : "ai-fab"}
				>
					<Sparkle aria-hidden="true" weight="fill" className="ai-fab__icon" />
					{unread ? <span aria-hidden="true" className="ai-fab__dot" /> : null}
				</button>
			) : null}
		</div>
	);
}

/**
 * The assistant, modelled on the CRM's: a floating widget everywhere, and the
 * same conversation UI as a full page at /chat. Access is still decided by the
 * backend from `assistant.use`; callers gate visibility.
 */
export function AiAssistant({
	variant = "floating",
	sessionParam,
}: {
	variant?: "floating" | "page";
	sessionParam?: string;
}) {
	const name = useAssistantName();
	return (
		<AiAssistantPanel
			name={name}
			page={variant === "page"}
			sessionParam={sessionParam}
		/>
	);
}
