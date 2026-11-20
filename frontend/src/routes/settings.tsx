import {
	Buildings,
	Check,
	CheckCircle,
	CircleHalf,
	CircleNotch,
	FileArrowUp,
	GearSix,
	LockKey,
	Monitor,
	Moon,
	PaintBrush,
	Palette,
	Plugs,
	ShieldCheck,
	SlidersHorizontal,
	Sparkle,
	Sun,
	TextAa,
	User,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import {
	createRoute,
	Link,
	Navigate,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
	ApiError,
	api,
	errorMessage,
	type Meta,
	type ModuleAccess,
	type Permission,
	type Role,
} from "../api";
import { useSaveAppearance } from "../appearance";
import { useAuth } from "../auth";
import { NoAccessPage } from "../components/ModuleGate";
import { TwoFactorCard } from "../components/profile/TwoFactorCard";
import {
	BadgeInput,
	type BadgeInputHandle,
} from "../components/settings/BadgeInput";
import {
	Badge,
	Button,
	Card,
	CardHeader,
	ErrorState,
	PageHeader,
	SkeletonStack,
	TextField,
} from "../components/ui";
import { formatDateTime, humanize, initials } from "../format";
import { moduleIcon } from "../modules";
import { isDirty, permissionSignature } from "../permissions";
import {
	queryKeys,
	useGeneralSettings,
	useMeta,
	useUpdateGeneralSettings,
} from "../queries";
import {
	ACCENT_OPTIONS,
	CONTRAST_OPTIONS,
	FONT_OPTIONS,
	THEME_OPTIONS,
	useTheme,
} from "../theme";
import { toast, toastApiError, toastSuccess } from "../toast";
import { appLayoutRoute } from "./app-layout";

function PermissionCheckbox({
	permission,
	checked,
	disabled,
	onChange,
}: {
	permission: Permission;
	checked: boolean;
	disabled: boolean;
	onChange: () => void;
}) {
	return (
		<label
			className={["perm", checked ? "perm--checked" : ""]
				.filter(Boolean)
				.join(" ")}
		>
			<input
				type="checkbox"
				className="perm__input"
				checked={checked}
				disabled={disabled}
				onChange={onChange}
			/>
			<span className="perm__text">
				<span className="perm__label">{permission.label}</span>
				<span className="perm__desc">
					{permission.description ?? permission.key}
				</span>
			</span>
		</label>
	);
}

function ModulePermissionGroup({
	module,
	checkedKeys,
	disabled,
	onToggle,
}: {
	module: ModuleAccess;
	checkedKeys: Set<string>;
	disabled: boolean;
	onToggle: (key: string) => void;
}) {
	const Icon = moduleIcon(module.key);
	const keys = module.permissions.map((permission) => permission.key);
	const grantedCount = keys.filter((key) => checkedKeys.has(key)).length;
	const allGranted = grantedCount === keys.length;

	const toggleAll = () => {
		for (const key of keys) {
			if (checkedKeys.has(key) === allGranted) onToggle(key);
		}
	};

	return (
		<div className="perm-group">
			<div className="perm-group__head">
				<h3 className="perm-group__title">
					<Icon size={16} weight="regular" aria-hidden="true" />
					{module.name}
					<span className="perm-group__count num">
						{grantedCount}/{keys.length}
					</span>
				</h3>
				{disabled ? null : (
					<button
						type="button"
						className="perm-group__toggle"
						onClick={toggleAll}
					>
						{allGranted ? "Clear all" : "Select all"}
					</button>
				)}
			</div>
			<div className="perm-list">
				{module.permissions.map((permission) => (
					<PermissionCheckbox
						key={permission.key}
						permission={permission}
						checked={checkedKeys.has(permission.key)}
						disabled={disabled}
						onChange={() => onToggle(permission.key)}
					/>
				))}
			</div>
		</div>
	);
}

function RolePermissionCard({
	role,
	allModules,
	totalPermissions,
}: {
	role: Role;
	allModules: ModuleAccess[];
	totalPermissions: number;
}) {
	const queryClient = useQueryClient();
	const locked = role.name === "ADMIN";
	const [draft, setDraft] = useState<string[]>(role.granted);
	const [pending, setPending] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Re-seed the draft when the server's grants change for someone else.
	const serverSignature = permissionSignature(role.granted);
	const lastServerSignature = useRef(serverSignature);
	useEffect(() => {
		if (lastServerSignature.current !== serverSignature) {
			lastServerSignature.current = serverSignature;
			setDraft(role.granted);
		}
	}, [serverSignature, role.granted]);

	const draftKeys = new Set(draft);
	const dirty = !locked && isDirty(draft, role.granted);
	const otherModules = allModules.filter(
		(module) => !role.modules.some((owned) => owned.key === module.key),
	);

	const toggle = (key: string) => {
		if (locked) return;
		setSaved(false);
		setError(null);
		setDraft((previous) =>
			previous.includes(key)
				? previous.filter((entry) => entry !== key)
				: [...previous, key],
		);
	};

	const save = async () => {
		setPending(true);
		setError(null);
		setSaved(false);
		try {
			// One request, reported from load to outcome by a single toast.
			const request = api.updateRolePermissions(role.id, draft);
			void toast.promise(request, {
				loading: `Saving ${role.name} permissions…`,
				success: (data) => `Permissions saved for ${data.role}`,
				error: (caught) =>
					caught instanceof ApiError
						? (caught.apiMessage() ?? "Permissions could not be saved")
						: "Permissions could not be saved",
			});
			const result = await request;
			setDraft(result.granted);
			setSaved(true);
			await queryClient.invalidateQueries({ queryKey: queryKeys.meta });
		} catch (caught) {
			setError(errorMessage(caught));
		} finally {
			setPending(false);
		}
	};

	return (
		<Card>
			<CardHeader
				title={<span className="matrix__role">{role.name}</span>}
				hint={`${role.modules.length} modules`}
				icon={<GearSix size={16} weight="regular" aria-hidden="true" />}
				actions={
					<Badge tone={locked ? "primary" : "outline"}>
						{locked ? "Always full access" : `${role.granted.length} granted`}
					</Badge>
				}
			/>

			{locked ? (
				<div className="role-locked">
					<span className="role-locked__icon">
						<LockKey size={18} weight="regular" aria-hidden="true" />
					</span>
					<div>
						<p className="role-locked__title">Every permission, always</p>
						<p className="role-locked__body">
							The ADMIN role holds a wildcard grant across all{" "}
							{allModules.length} modules. It can&apos;t be narrowed, so there
							is nothing to edit here.
						</p>
					</div>
				</div>
			) : (
				<div className="perm-groups">
					{role.modules.map((module) => (
						<ModulePermissionGroup
							key={module.key}
							module={module}
							checkedKeys={draftKeys}
							disabled={locked || pending}
							onToggle={toggle}
						/>
					))}
				</div>
			)}

			{!locked && otherModules.length > 0 ? (
				<details className="perm-extra">
					<summary>
						Grant access to another module ({otherModules.length})
					</summary>
					<div className="perm-groups">
						{otherModules.map((module) => (
							<ModulePermissionGroup
								key={module.key}
								module={module}
								checkedKeys={draftKeys}
								disabled={pending}
								onToggle={toggle}
							/>
						))}
					</div>
				</details>
			) : null}

			{locked ? null : (
				<div className="perm-actions perm-actions--sticky">
					<Button
						variant="primary"
						size="sm"
						onClick={() => void save()}
						disabled={!dirty || pending}
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
						Save changes
					</Button>
					{saved ? (
						<span className="perm-actions__status perm-actions__status--saved">
							<CheckCircle size={14} weight="fill" aria-hidden="true" />
							Saved
						</span>
					) : dirty ? (
						<span className="perm-actions__status">Unsaved changes</span>
					) : null}
					{error ? <span className="form-note">{error}</span> : null}
					<span
						className="perm-actions__status num"
						style={{ marginLeft: "auto" }}
					>
						{draft.length} of {totalPermissions} permissions
					</span>
				</div>
			)}
		</Card>
	);
}

function SettingsContent({ meta }: { meta: Meta }) {
	const totalPermissions = meta.modules.reduce(
		(total, module) => total + module.permissions.length,
		0,
	);
	// Open on the first editable role: ADMIN has nothing to change.
	const [roleId, setRoleId] = useState(
		() =>
			(meta.roles.find((role) => role.name !== "ADMIN") ?? meta.roles[0])?.id,
	);
	const role = meta.roles.find((entry) => entry.id === roleId) ?? meta.roles[0];

	if (!role) return null;

	return (
		<div className="stack">
			<div className="assistant-tabs" role="tablist" aria-label="Roles">
				{meta.roles.map((entry) => (
					<button
						key={entry.id}
						type="button"
						role="tab"
						aria-selected={entry.id === role.id}
						className={
							entry.id === role.id
								? "assistant-tab assistant-tab--active"
								: "assistant-tab"
						}
						onClick={() => setRoleId(entry.id)}
					>
						{humanize(entry.name)}
					</button>
				))}
			</div>
			<RolePermissionCard
				key={role.id}
				role={role}
				allModules={meta.modules}
				totalPermissions={totalPermissions}
			/>
		</div>
	);
}

type SectionIcon = typeof ShieldCheck;

function PermissionsPage() {
	const meta = useMeta();

	return (
		<>
			<PageHeader
				title="Permissions"
				description="Choose a role, tick what it may do in each module, then save. Saving replaces that role's grants for everyone who holds it."
			/>

			{meta.isPending ? (
				<Card>
					<SkeletonStack rows={6} />
				</Card>
			) : meta.isError ? (
				<Card>
					<ErrorState
						title="Roles could not be loaded"
						message={errorMessage(meta.error)}
						onRetry={() => void meta.refetch()}
					/>
				</Card>
			) : (
				<SettingsContent meta={meta.data} />
			)}
		</>
	);
}

const AI_SCOPE_TABS = [
	{
		key: "institutional" as const,
		label: "Institutional",
		icon: Buildings,
		title: "Institutional providers",
		description:
			"Configured by admins and shared with everyone the school serves. One base URL and API key per provider; the admin picks which of its models are available.",
		points: [
			"Only users with the settings.manage permission can edit them",
			"Every enabled model is offered to institutional chats",
			"Usage counts against the school's provider account",
		],
	},
	{
		key: "personal" as const,
		label: "Personal",
		icon: User,
		title: "Personal providers",
		description:
			"Each user can connect their own OpenAI-compatible provider. Personal chats use personal models first and never touch the school's keys.",
		points: [
			"The key is stored encrypted and shown only as a masked hint",
			"Model toggles apply per user, not per role",
			"Deleting the provider immediately revokes its access",
		],
	},
];

function AiPage() {
	const [scope, setScope] =
		useState<(typeof AI_SCOPE_TABS)[number]["key"]>("institutional");
	const active = AI_SCOPE_TABS.find((tab) => tab.key === scope)!;

	return (
		<>
			<PageHeader
				title="AI"
				description="Providers, models and API keys for the assistant. Keys are verified, encrypted at rest and never returned to the frontend."
			/>

			<div
				className="assistant-tabs"
				role="tablist"
				aria-label="AI provider scopes"
			>
				{AI_SCOPE_TABS.map((tab) => (
					<button
						key={tab.key}
						type="button"
						role="tab"
						aria-selected={tab.key === scope}
						className={
							tab.key === scope
								? "assistant-tab assistant-tab--active"
								: "assistant-tab"
						}
						onClick={() => setScope(tab.key)}
					>
						{tab.label}
					</button>
				))}
			</div>

			<div className="stack">
				<Card>
					<CardHeader
						title={active.title}
						icon={<active.icon size={16} weight="regular" aria-hidden="true" />}
					/>
					<div className="card__body stack--sm">
						<p className="settings-copy">{active.description}</p>
						<ul className="check-list">
							{active.points.map((point) => (
								<li key={point}>
									<CheckCircle size={16} weight="fill" aria-hidden="true" />
									{point}
								</li>
							))}
						</ul>
					</div>
					<footer className="card__footer card__footer--actions">
						<span>Providers and models are managed on the assistant page.</span>
						<Link to="/assistant" className="btn btn--primary btn--sm">
							Manage providers
						</Link>
					</footer>
				</Card>

				<Card>
					<CardHeader
						title="How keys are handled"
						icon={<ShieldCheck size={16} weight="regular" aria-hidden="true" />}
					/>
					<div className="card__body">
						<p className="settings-copy">
							Keys are verified against the provider&apos;s model list on save,
							then encrypted with AES-256-GCM under a server secret (
							<code>AI_ENCRYPTION_SECRET</code>). They are decrypted in memory
							only while a chat is streaming, and responses carry a masked hint
							(<code>…abcd</code>) instead of the key.
						</p>
					</div>
				</Card>
			</div>
		</>
	);
}

const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon } as const;

function AppearancePage() {
	const { themePreference, font, accent, contrastPreference, save, saving } =
		useSaveAppearance();
	const { theme, contrast } = useTheme();

	return (
		<>
			<PageHeader
				title="Appearance"
				description="Theme, accent color, contrast and reading font for your account. Changes apply right away and follow you to any device you sign in on."
				actions={saving ? <Badge tone="outline">Saving…</Badge> : null}
			/>

			<div className="stack">
				<Card>
					<CardHeader
						title="Theme"
						icon={<PaintBrush size={16} weight="regular" aria-hidden="true" />}
					/>
					<fieldset className="card__body choice-grid">
						<legend className="visually-hidden">Theme</legend>
						{THEME_OPTIONS.map((option) => {
							const Icon = THEME_ICONS[option.value];
							return (
								<label key={option.value} className="choice">
									<input
										type="radio"
										name="theme"
										value={option.value}
										checked={themePreference === option.value}
										onChange={() => save({ theme: option.value })}
										className="choice__input"
									/>
									<span
										className={`choice__preview choice__preview--${option.value}`}
										aria-hidden="true"
									>
										<span />
										<span />
										<span />
									</span>
									<span className="choice__row">
										<Icon size={16} weight="regular" aria-hidden="true" />
										<span className="choice__label">{option.label}</span>
									</span>
									<span className="choice__check" aria-hidden="true">
										<Check size={12} weight="bold" />
									</span>
								</label>
							);
						})}
					</fieldset>
				</Card>

				<Card>
					<CardHeader
						title="Accent color"
						icon={<Palette size={16} weight="regular" aria-hidden="true" />}
					/>
					<div className="card__body stack--sm">
						<fieldset className="accent-picker">
							<legend className="visually-hidden">Accent color</legend>
							{ACCENT_OPTIONS.map((option) => (
								<label
									key={option.value}
									className="accent-option"
									title={option.label}
								>
									<input
										type="radio"
										name="accent"
										value={option.value}
										checked={accent === option.value}
										onChange={() => save({ accent: option.value })}
										className="accent-option__input"
									/>
									<span
										className="accent-option__swatch"
										style={{ background: option.swatch[theme] }}
										aria-hidden="true"
									/>
									<span className="accent-option__label">{option.label}</span>
								</label>
							))}
						</fieldset>
						<div className="accent-preview" aria-hidden="true">
							<span className="accent-preview__button">Primary</span>
							<span className="accent-preview__link">Link text</span>
							<span className="accent-preview__soft">Selected</span>
							<span className="accent-preview__check">
								<Check size={11} weight="bold" />
							</span>
						</div>
						<p className="field__description">
							Every accent meets WCAG contrast in light and dark mode
							{contrast === "high" ? ", at AAA (7:1) for text" : ""}. Status
							colors (success, warning, error) keep their meaning whatever the
							accent.
						</p>
					</div>
				</Card>

				<Card>
					<CardHeader
						title="Contrast"
						icon={<CircleHalf size={16} weight="regular" aria-hidden="true" />}
					/>
					<fieldset className="card__body choice-grid">
						<legend className="visually-hidden">Contrast</legend>
						{CONTRAST_OPTIONS.map((option) => (
							<label key={option.value} className="choice choice--font">
								<input
									type="radio"
									name="contrast"
									value={option.value}
									checked={contrastPreference === option.value}
									onChange={() => save({ contrast: option.value })}
									className="choice__input"
								/>
								<span className="choice__label">{option.label}</span>
								<span className="choice__description">
									{option.description}
								</span>
								<span className="choice__check" aria-hidden="true">
									<Check size={12} weight="bold" />
								</span>
							</label>
						))}
					</fieldset>
				</Card>

				<Card>
					<CardHeader
						title="Reading font"
						icon={<TextAa size={16} weight="regular" aria-hidden="true" />}
					/>
					<fieldset className="card__body choice-grid">
						<legend className="visually-hidden">Reading font</legend>
						{FONT_OPTIONS.map((option) => (
							<label
								key={option.value}
								className={`choice choice--font choice--font-${option.value}`}
							>
								<input
									type="radio"
									name="font"
									value={option.value}
									checked={font === option.value}
									onChange={() => save({ font: option.value })}
									className="choice__input"
								/>
								<span className="choice__sample" aria-hidden="true">
									Aa
								</span>
								<span className="choice__label">{option.label}</span>
								<span className="choice__description">
									{option.description}
								</span>
								<span className="choice__check" aria-hidden="true">
									<Check size={12} weight="bold" />
								</span>
							</label>
						))}
					</fieldset>
				</Card>
			</div>
		</>
	);
}

/* --- Profile: who you are, and what the assistant can reach ---------------- */

function ProfilePage() {
	const { session } = useAuth();

	if (!session) return null;

	const { user, modules, permissions, signedInAt } = session;

	return (
		<>
			<PageHeader
				title="Profile"
				description="Your account, the role behind it, and the apps your assistant is allowed to act through."
				actions={<Badge tone="primary">{user.role}</Badge>}
			/>

			<div className="stack">
				<Card>
					<CardHeader
						title="Account"
						hint="Read-only"
						icon={<User size={16} weight="regular" aria-hidden="true" />}
					/>
					<div className="card__body stack--sm">
						<div className="identity">
							<span className="avatar avatar--lg" aria-hidden="true">
								{initials(user.name)}
							</span>
							<div className="identity__text">
								<p className="identity__name">{user.name}</p>
								<p className="identity__email">{user.email}</p>
							</div>
						</div>

						<dl className="kv-grid">
							<div className="kv-cell">
								<dt>Role</dt>
								<dd>{humanize(user.role)}</dd>
							</div>
							<div className="kv-cell">
								<dt>Modules</dt>
								<dd className="num">{modules.length}</dd>
							</div>
							<div className="kv-cell">
								<dt>Permissions</dt>
								<dd className="num">{permissions.length}</dd>
							</div>
							<div className="kv-cell">
								<dt>Signed in</dt>
								<dd>{formatDateTime(signedInAt)}</dd>
							</div>
						</dl>
					</div>
					<footer className="card__footer">
						Name, email and role come from the school directory: ask an
						administrator to change them.
					</footer>
				</Card>

				<TwoFactorCard userId={user.id} />

				<Card>
					<CardHeader
						title="Connected apps"
						icon={<Plugs size={16} weight="regular" aria-hidden="true" />}
					/>
					<div className="card__body">
						<p className="settings-copy">
							Apps the assistant can act through for you are connected on the AI
							assistant page, under its MCP tab.
						</p>
					</div>
					<footer className="card__footer card__footer--actions">
						<span>Connections are per account.</span>
						<Link to="/assistant" className="btn btn--secondary btn--sm">
							Manage MCP apps
						</Link>
					</footer>
				</Card>
			</div>
		</>
	);
}

/* --- General: the limits every assignment hand-in is checked against ------ */

const MIN_SUBMISSION_MB = 1;
const MAX_SUBMISSION_MB = 100;

/**
 * One comparable string for a limits pair, so "did this change?" is a string
 * comparison rather than a diff of two shapes. The list is sorted first: the
 * server stores an allow-list, and its order carries no meaning.
 */
function submissionKey(types: string[], maxSizeMb: number | string): string {
	return JSON.stringify({
		types: [...types].sort((a, b) => a.localeCompare(b)),
		maxSizeMb: String(maxSizeMb).trim(),
	});
}

function GeneralPage() {
	const settings = useGeneralSettings();
	const update = useUpdateGeneralSettings();
	const badges = useRef<BadgeInputHandle>(null);

	const [types, setTypes] = useState<string[]>([]);
	const [maxSize, setMaxSize] = useState("");
	// What is typed in the badge field but not yet a badge: still unsaved work,
	// so it counts as a change and Save commits it before writing.
	const [pendingType, setPendingType] = useState("");
	const [error, setError] = useState<string | null>(null);
	// The pair that is actually stored, as of the last successful save: it is
	// what tells "Saved" apart from "Unsaved changes" after the query re-seeds.
	const [savedKey, setSavedKey] = useState<string | null>(null);

	// The server's answer seeds the draft, and re-seeds it after a save, so the
	// form never drifts from what the API says is stored.
	useEffect(() => {
		if (!settings.data) return;
		setTypes(settings.data.submission_allowed_file_types);
		setMaxSize(String(settings.data.submission_max_file_mb));
	}, [settings.data]);

	const serverKey = settings.data
		? submissionKey(
				settings.data.submission_allowed_file_types,
				settings.data.submission_max_file_mb,
			)
		: null;
	const draftKey = submissionKey(types, maxSize);
	const hasPendingType = pendingType.trim() !== "";
	const dirty = serverKey !== null && draftKey !== serverKey;
	const changed = dirty || hasPendingType;

	// Validate against the same bounds the API enforces, so a save is refused
	// here with a field-level reason instead of coming back as a 400.
	const sizeNumber = Number(maxSize);
	const sizeError = !maxSize.trim()
		? "Enter a maximum size in MB."
		: !Number.isFinite(sizeNumber) || !Number.isInteger(sizeNumber)
			? "Use a whole number of megabytes."
			: sizeNumber < MIN_SUBMISSION_MB || sizeNumber > MAX_SUBMISSION_MB
				? `Between ${MIN_SUBMISSION_MB} and ${MAX_SUBMISSION_MB} MB.`
				: "";
	const typesError =
		types.length === 0 ? "Keep at least one allowed file type." : "";

	const pending = update.isPending;
	const canSave = changed && !typesError && !sizeError && !pending;
	const saved = !changed && savedKey !== null && savedKey === draftKey;

	const save = async () => {
		if (!canSave) return;
		// A type still sitting in the text field is part of what is being saved.
		const committed = badges.current?.flush() ?? types;
		if (committed === null) return; // Refused; the field says why.
		setPendingType("");
		setError(null);

		const payload = {
			submission_allowed_file_types: [...committed].sort((a, b) =>
				a.localeCompare(b),
			),
			submission_max_file_mb: sizeNumber,
		};
		try {
			await update.mutateAsync(payload);
			setSavedKey(
				submissionKey(
					payload.submission_allowed_file_types,
					payload.submission_max_file_mb,
				),
			);
			toastSuccess(
				"Submission limits saved",
				"Every assignment hand-in is measured against them from now on.",
			);
		} catch (caught) {
			setSavedKey(null);
			setError(errorMessage(caught));
			toastApiError(caught, "The limits could not be saved");
		}
	};

	return (
		<>
			<PageHeader
				title="General"
				description="School-wide limits for assignment hand-ins: which files a student may upload, and how large one file may be."
			/>

			{settings.isPending ? (
				<Card>
					<SkeletonStack rows={4} />
				</Card>
			) : settings.isError ? (
				<Card>
					<ErrorState
						title="Limits could not be loaded"
						message={errorMessage(settings.error)}
						onRetry={() => void settings.refetch()}
					/>
				</Card>
			) : (
				<div className="stack">
					<Card>
						<CardHeader
							title="Submission limits"
							hint="Applies to every assignment"
							icon={
								<FileArrowUp size={16} weight="regular" aria-hidden="true" />
							}
						/>
						<div className="card__body stack--sm">
							<BadgeInput
								ref={badges}
								label="Allowed file types"
								values={types}
								onChange={(next) => {
									setTypes(next);
									setError(null);
								}}
								onDraftChange={setPendingType}
								error={typesError}
								max={50}
								disabled={pending}
								hint="The extensions a student may hand in. Spreadsheets, documents, archives and images by default — Tab, Enter or a comma adds one."
							/>

							<TextField
								label="Maximum file size"
								type="number"
								min={MIN_SUBMISSION_MB}
								inputMode="numeric"
								value={maxSize}
								onChange={(value) => {
									setMaxSize(value);
									setError(null);
								}}
								error={sizeError}
								disabled={pending}
								trailing={<span className="field__suffix">MB</span>}
								hint={`Between ${MIN_SUBMISSION_MB} and ${MAX_SUBMISSION_MB} MB per file. 25 MB covers a photographed worksheet without inviting a video.`}
							/>
							{error ? (
								<span className="form-note" role="alert">
									{error}
								</span>
							) : null}
						</div>
						<footer className="card__footer card__footer--actions">
							<span
								className={
									saved
										? "perm-actions__status perm-actions__status--saved"
										: "perm-actions__status"
								}
								role="status"
							>
								{saved ? (
									<>
										<CheckCircle size={14} weight="fill" aria-hidden="true" />
										Saved
									</>
								) : changed ? (
									"Unsaved changes"
								) : (
									"Up to date with the server"
								)}
							</span>
							<Button
								variant="primary"
								size="sm"
								onClick={() => void save()}
								disabled={!canSave}
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
								Save changes
							</Button>
						</footer>
					</Card>

					<Card>
						<CardHeader
							title="How these limits apply"
							hint="Read-only"
							icon={
								<ShieldCheck size={16} weight="regular" aria-hidden="true" />
							}
						/>
						<div className="card__body stack--sm">
							<p className="settings-copy">
								These two limits apply to assignment hand-ins, across the whole
								school — not per subject and not per assignment.
							</p>
							<ul className="check-list">
								<li>
									<CheckCircle size={16} weight="fill" aria-hidden="true" />
									An upload is sniffed by content type: the bytes must match the
									extension, so a renamed executable or a web page never gets
									in.
								</li>
								<li>
									<CheckCircle size={16} weight="fill" aria-hidden="true" />
									Dangerous types are always rejected, even if they reach this
									list: html, svg, scripts and executables.
								</li>
								<li>
									<CheckCircle size={16} weight="fill" aria-hidden="true" />
									Files already handed in are untouched; the new limits apply to
									the next upload.
								</li>
								<li>
									<CheckCircle size={16} weight="fill" aria-hidden="true" />
									Students see the list and the cap in the upload picker before
									they choose a file.
								</li>
							</ul>
						</div>
						<footer className="card__footer">
							Only holders of the settings.manage permission can change these
							limits.
						</footer>
					</Card>
				</div>
			)}
		</>
	);
}

/* --- Settings shell: local sidebar + section content ---------------------- */

/**
 * The settings sections, and what each one asks for.
 *
 * Two kinds live here, and the distinction is the whole point of this list:
 *
 * - Per-person screens (`profile`, `appearance`) change only the signed-in
 *   account — name and role are read-only there, theme and reading font are
 *   saved under `/api/me`. Every role keeps them, so they ask for nothing.
 * - School-wide screens (`general`, `permissions`, `ai`) change what everyone
 *   gets, and ask for `settings.manage` — which ADMIN holds and students and
 *   lecturers do not.
 *
 * One list drives both the navigation and the gate below, so a section can
 * never be advertised to a role that would be refused on arrival.
 */
type SettingsSection = {
	to: string;
	label: string;
	icon: SectionIcon;
	/** Permission the section needs on top of being signed in; omitted = any. */
	permission?: string;
};

const SETTINGS_SECTIONS: SettingsSection[] = [
	{ to: "/settings/profile", label: "Profile", icon: User },
	{ to: "/settings/appearance", label: "Appearance", icon: PaintBrush },
	{
		to: "/settings/general",
		label: "General",
		icon: SlidersHorizontal,
		permission: "settings.manage",
	},
	{
		to: "/settings/permissions",
		label: "Permissions",
		icon: ShieldCheck,
		permission: "settings.manage",
	},
	{
		to: "/settings/ai",
		label: "AI",
		icon: Sparkle,
		permission: "settings.manage",
	},
];

function SettingsSidebar({
	pathname,
	reaches,
}: {
	pathname: string;
	reaches: (section: SettingsSection) => boolean;
}) {
	return (
		<aside className="settings__sidebar">
			<nav className="settings__nav" aria-label="Settings sections">
				<span className="settings__nav-label">Settings</span>
				{SETTINGS_SECTIONS.filter(reaches).map((section) => {
					const active =
						pathname === section.to || pathname.startsWith(`${section.to}/`);
					const Icon = section.icon;
					return (
						<Link
							key={section.to}
							to={section.to}
							className={
								active
									? "settings__item settings__item--active"
									: "settings__item"
							}
							aria-current={active ? "page" : undefined}
						>
							<Icon
								size={16}
								weight={active ? "fill" : "regular"}
								aria-hidden="true"
								className="settings__item-icon"
							/>
							{section.label}
						</Link>
					);
				})}
			</nav>
		</aside>
	);
}

function SettingsLayout() {
	const { isAdmin, hasPermission } = useAuth();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	// ADMIN holds every permission; for everybody else the key decides.
	const reaches = (section: SettingsSection) =>
		!section.permission || isAdmin || hasPermission(section.permission);

	// The section this URL belongs to, if it is one we know: a visitor who types
	// an address gets the same answer the sidebar would have given them.
	const target = SETTINGS_SECTIONS.find(
		(section) =>
			pathname === section.to || pathname.startsWith(`${section.to}/`),
	);
	const refusal = target && !reaches(target) ? target : null;

	if (refusal) {
		return (
			<NoAccessPage
				moduleKey="settings"
				label="Settings"
				body={
					<>
						The <strong>{refusal.label}</strong> section needs the{" "}
						<code>{refusal.permission}</code> permission. Your role does not
						hold it — your own{" "}
						<Link to="/settings/profile" className="link-btn">
							profile
						</Link>{" "}
						and appearance are still yours to change.
					</>
				}
			/>
		);
	}

	return (
		<div className="settings">
			<SettingsSidebar pathname={pathname} reaches={reaches} />
			<div className="settings__main">
				<Outlet />
			</div>
		</div>
	);
}

/** Base "/settings" route; children attach below, the tree is what registers. */
export const settingsRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/settings",
	component: SettingsLayout,
});

export const settingsIndexRoute = createRoute({
	getParentRoute: () => settingsRoute,
	path: "/",
	component: () => <Navigate to="/settings/profile" replace />,
});

export const settingsProfileRoute = createRoute({
	getParentRoute: () => settingsRoute,
	path: "profile",
	component: ProfilePage,
});

export const settingsAppearanceRoute = createRoute({
	getParentRoute: () => settingsRoute,
	path: "appearance",
	component: AppearancePage,
});

export const settingsGeneralRoute = createRoute({
	getParentRoute: () => settingsRoute,
	path: "general",
	component: GeneralPage,
});

export const settingsPermissionsRoute = createRoute({
	getParentRoute: () => settingsRoute,
	path: "permissions",
	component: PermissionsPage,
});

export const settingsAiRoute = createRoute({
	getParentRoute: () => settingsRoute,
	path: "ai",
	component: AiPage,
});

export const settingsTree = settingsRoute.addChildren([
	settingsIndexRoute,
	settingsProfileRoute,
	settingsAppearanceRoute,
	settingsGeneralRoute,
	settingsPermissionsRoute,
	settingsAiRoute,
]);
