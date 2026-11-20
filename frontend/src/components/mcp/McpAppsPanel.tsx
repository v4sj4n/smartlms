import {
	CheckCircle,
	CircleNotch,
	Plug,
	PlugsConnected,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { errorMessage, type McpApp, type McpAppList } from "../../api";
import { formatDateTime } from "../../format";
import {
	useConnectMcpApp,
	useDisconnectMcpApp,
	useMcpApps,
} from "../../queries";
import { toast } from "../../toast";
import {
	Badge,
	Button,
	Card,
	CardHeader,
	ErrorState,
	InlineNote,
	SkeletonStack,
} from "../ui";

/**
 * The avatar of one MCP app: its mark on a tinted disc. The tint follows the
 * `tone` the backend stores, which maps to a HIG system colour in styles.css,
 * so the same class works in light and dark mode.
 */
export function McpAppAvatar({
	app,
	size = "md",
}: {
	app: Pick<McpApp, "name" | "glyph" | "tone">;
	size?: "sm" | "md";
}) {
	return (
		<span
			className={[
				"app-avatar",
				`app-avatar--${app.tone}`,
				size === "sm" ? "app-avatar--sm" : "",
			]
				.filter(Boolean)
				.join(" ")}
			aria-hidden="true"
			title={app.name}
		>
			{app.glyph}
		</span>
	);
}

/** The connected apps as avatars, overlapped the way macOS stacks them. */
function AvatarStack({ apps }: { apps: McpApp[] }) {
	return (
		<span
			className="app-avatar-stack"
			role="img"
			aria-label={`Connected: ${apps.map((app) => app.name).join(", ")}`}
		>
			{apps.map((app) => (
				<McpAppAvatar key={app.key} app={app} />
			))}
		</span>
	);
}

function ConnectedRow({
	app,
	pending,
	onDisconnect,
}: {
	app: McpApp;
	pending: boolean;
	onDisconnect: () => void;
}) {
	return (
		<li className="mcp-row">
			<McpAppAvatar app={app} />
			<div className="mcp-row__text">
				<p className="mcp-row__name">
					{app.name}
					<Badge tone="outline">{app.category}</Badge>
				</p>
				<p className="mcp-row__desc">{app.description}</p>
				<div className="mcp-row__meta">
					{app.scopes.map((scope) => (
						<code key={scope} className="mcp-scope">
							{scope}
						</code>
					))}
					<span className="mcp-row__dates">
						Connected{" "}
						{app.connected_at ? formatDateTime(app.connected_at) : "—"}
						{app.last_used_at
							? ` · Last used ${formatDateTime(app.last_used_at)}`
							: " · Not used yet"}
					</span>
				</div>
			</div>
			<Button
				variant="ghost"
				size="sm"
				aria-label={`Disconnect ${app.name}`}
				onClick={onDisconnect}
				disabled={pending}
				icon={
					pending ? (
						<CircleNotch
							size={14}
							weight="bold"
							className="spinner"
							aria-hidden="true"
						/>
					) : null
				}
			>
				Disconnect
			</Button>
		</li>
	);
}

function AvailableRow({
	app,
	pending,
	onConnect,
}: {
	app: McpApp;
	pending: boolean;
	onConnect: () => void;
}) {
	return (
		<li className="mcp-row mcp-row--compact">
			<McpAppAvatar app={app} size="sm" />
			<div className="mcp-row__text">
				<p className="mcp-row__name">{app.name}</p>
				<p className="mcp-row__desc">{app.description}</p>
			</div>
			<Button
				variant="secondary"
				size="sm"
				aria-label={`Connect ${app.name}`}
				onClick={onConnect}
				disabled={pending}
				icon={
					pending ? (
						<CircleNotch
							size={14}
							weight="bold"
							className="spinner"
							aria-hidden="true"
						/>
					) : (
						<Plug size={14} weight="regular" aria-hidden="true" />
					)
				}
			>
				Connect
			</Button>
		</li>
	);
}

/**
 * Every MCP app this person has connected to the assistant, drawn with the
 * app's avatar, plus the catalog left to connect. The AI assistant page renders
 * it as its MCP tab; nothing else owns a second copy of the same state.
 */
export function McpAppsPanel({
	userId,
	title = "Connected apps",
	hint,
}: {
	userId?: string;
	title?: string;
	hint?: string;
}) {
	const apps = useMcpApps(userId);
	const connect = useConnectMcpApp(userId);
	const disconnect = useDisconnectMcpApp(userId);
	// Which app is mid-flight, so only its own row shows a spinner: the two
	// mutations are shared, and their `variables` only remember the latest call.
	const [pending, setPending] = useState<
		Record<string, "connect" | "disconnect">
	>({});
	const headingRef = useRef<HTMLSpanElement>(null);

	const list: McpAppList | undefined = apps.data;
	const connected = list?.connected ?? [];
	const available = list?.available ?? [];
	const total = connected.length + available.length;

	const run = (app: McpApp, verb: "connect" | "disconnect") => {
		setPending((current) => ({ ...current, [app.key]: verb }));
		const clear = () =>
			setPending((current) => {
				const next = { ...current };
				delete next[app.key];
				return next;
			});

		const request =
			verb === "connect"
				? connect.mutateAsync(app.key)
				: disconnect.mutateAsync(app.key);

		void toast.promise(request, {
			loading:
				verb === "connect"
					? `Connecting ${app.name}…`
					: `Disconnecting ${app.name}…`,
			success:
				verb === "connect"
					? `${app.name} connected`
					: `${app.name} disconnected — access revoked`,
			error: (caught) => errorMessage(caught),
		});

		// Both mutations answer with the fresh catalog, so a row simply moves from
		// one list to the other. After a revoke the button is gone from the DOM, so
		// focus goes back to the section heading instead of falling to the body.
		request.then(() => {
			clear();
			if (verb === "disconnect") headingRef.current?.focus();
		}, clear);
	};

	return (
		<Card>
			<CardHeader
				title={title}
				hint={hint}
				icon={<PlugsConnected size={16} weight="regular" aria-hidden="true" />}
				actions={
					list ? (
						connected.length > 0 ? (
							<Badge tone="success">
								{connected.length} of {total} connected
							</Badge>
						) : (
							<Badge tone="outline">None connected</Badge>
						)
					) : null
				}
			/>

			{apps.isPending ? (
				<div className="card__body">
					<SkeletonStack rows={3} />
				</div>
			) : apps.isError ? (
				<div className="card__body">
					<ErrorState
						title="Connected apps could not be loaded"
						message={errorMessage(apps.error)}
						onRetry={() => void apps.refetch()}
					/>
				</div>
			) : total === 0 ? (
				<div className="card__body card__body--tight">
					<InlineNote>
						No MCP apps are in the catalog yet. An administrator adds them
						before anyone can connect one.
					</InlineNote>
				</div>
			) : (
				<>
					<div className="card__body stack--sm">
						<div className="mcp-heading">
							<span
								className="mcp-heading__title"
								tabIndex={-1}
								ref={headingRef}
							>
								Connected to your assistant
							</span>
							{connected.length > 0 ? <AvatarStack apps={connected} /> : null}
						</div>

						{connected.length === 0 ? (
							<InlineNote>
								No apps connected yet. Pick one below and the assistant can
								start using it right away.
							</InlineNote>
						) : (
							<ul className="mcp-list">
								{connected.map((app) => (
									<ConnectedRow
										key={app.key}
										app={app}
										pending={pending[app.key] === "disconnect"}
										onDisconnect={() => run(app, "disconnect")}
									/>
								))}
							</ul>
						)}
					</div>

					{available.length > 0 ? (
						<details className="perm-extra">
							<summary>Connect another app ({available.length})</summary>
							<ul className="mcp-list mcp-list--extra">
								{available.map((app) => (
									<AvailableRow
										key={app.key}
										app={app}
										pending={pending[app.key] === "connect"}
										onConnect={() => run(app, "connect")}
									/>
								))}
							</ul>
						</details>
					) : (
						<div className="card__body card__body--tight">
							<InlineNote>
								<span className="row row--tight">
									<CheckCircle size={14} weight="fill" aria-hidden="true" />
									Every app in the catalog is connected to your account.
								</span>
							</InlineNote>
						</div>
					)}
				</>
			)}

			<footer className="card__footer mcp-footnote">
				Connections are saved per person: sign in on another device and the same
				apps are still here.
			</footer>
		</Card>
	);
}
