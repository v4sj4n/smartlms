import { CaretDown, LockKey, Plus, ShieldCheck } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	api,
	errorMessage,
	type Meta,
	type ModuleAccess,
	type Role,
} from "../api";
import { useAuth } from "../auth";
import { NoAccessPage } from "../components/ModuleGate";
import {
	Badge,
	Button,
	Card,
	CardHeader,
	Dialog,
	EmptyState,
	ErrorState,
	InlineNote,
	PageHeader,
	SelectField,
	SkeletonStack,
	TextField,
} from "../components/ui";
import { humanize } from "../format";
import { moduleIcon, moduleLabel } from "../modules";
import { isDirty } from "../permissions";
import { queryKeys, useMeta } from "../queries";
import { toastApiError, toastSuccess } from "../toast";
import { appLayoutRoute } from "./app-layout";

const ADMIN = "ADMIN";

function sortModules(modules: ModuleAccess[]) {
	return [...modules].sort((a, b) =>
		moduleLabel(a.key).localeCompare(moduleLabel(b.key)),
	);
}

/** Short label for a permission key, e.g. `campuses.manage` → `manage`. */
function shortKey(key: string) {
	return key.split(".").slice(1).join(".") || key;
}

/* ---------------------------------------------------------------- dropdown */

function PermissionDropdown({
	module,
	hasModule,
	granted,
	disabled,
	onToggleModule,
	onTogglePermission,
}: {
	module: ModuleAccess;
	hasModule: boolean;
	granted: Set<string>;
	disabled: boolean;
	onToggleModule: (on: boolean) => void;
	onTogglePermission: (key: string) => void;
}) {
	const ref = useRef<HTMLDetailsElement>(null);
	const picked = module.permissions.filter((p) => granted.has(p.key));

	// Close when clicking outside.
	useEffect(() => {
		const onClick = (event: MouseEvent) => {
			const el = ref.current;
			if (el?.open && !el.contains(event.target as Node)) el.open = false;
		};
		document.addEventListener("mousedown", onClick);
		return () => document.removeEventListener("mousedown", onClick);
	}, []);

	const summary = !hasModule
		? "No access"
		: picked.length === 0
			? "Module only"
			: picked.length === module.permissions.length
				? "All permissions"
				: picked.map((p) => shortKey(p.key)).join(", ");

	if (disabled) {
		return <span className="perm-dd__static">{summary}</span>;
	}

	return (
		<details ref={ref} className="perm-dd">
			<summary
				className="perm-dd__trigger"
				aria-label={`${module.name} permissions: ${summary}`}
			>
				<span className={hasModule ? "" : "perm-dd__muted"}>{summary}</span>
				<CaretDown size={12} weight="bold" aria-hidden="true" />
			</summary>
			<div
				className="perm-dd__menu"
				role="group"
				aria-label={`${module.name} permissions`}
			>
				<label className="perm-dd__option">
					<input
						type="checkbox"
						checked={hasModule}
						onChange={(e) => onToggleModule(e.target.checked)}
					/>
					<span>
						<span className="perm-dd__label">Module access</span>
						<span className="perm-dd__hint">Can open {module.name}</span>
					</span>
				</label>
				{module.permissions.length > 0 ? <hr className="perm-dd__sep" /> : null}
				{module.permissions.map((permission) => (
					<label key={permission.key} className="perm-dd__option">
						<input
							type="checkbox"
							checked={granted.has(permission.key)}
							onChange={() => onTogglePermission(permission.key)}
						/>
						<span>
							<span className="perm-dd__label">{permission.label}</span>
							<span className="perm-dd__hint">{permission.key}</span>
						</span>
					</label>
				))}
			</div>
		</details>
	);
}

/* ------------------------------------------------------------ role detail */

function RoleDetail({
	role,
	modules,
	canEdit,
}: {
	role: Role;
	modules: ModuleAccess[];
	canEdit: boolean;
}) {
	const queryClient = useQueryClient();
	const locked = role.name === ADMIN || !canEdit;
	const serverModules = useMemo(
		() => role.modules.map((m) => m.key),
		[role.modules],
	);
	const [draftModules, setDraftModules] = useState<string[]>(serverModules);
	const [draftGrants, setDraftGrants] = useState<string[]>(role.granted);
	const [pending, setPending] = useState(false);

	// Reset the draft when switching roles or after the server changes.
	useEffect(() => {
		setDraftModules(serverModules);
		setDraftGrants(role.granted);
	}, [role.id, serverModules, role.granted]);

	const dirty =
		isDirty(draftModules, serverModules) || isDirty(draftGrants, role.granted);
	const grantSet = new Set(draftGrants);

	const toggleModule = (module: ModuleAccess, on: boolean) => {
		setDraftModules((prev) =>
			on
				? [...new Set([...prev, module.key])]
				: prev.filter((k) => k !== module.key),
		);
		// Revoking module access also drops its permissions.
		if (!on) {
			const keys = new Set(module.permissions.map((p) => p.key));
			setDraftGrants((prev) => prev.filter((k) => !keys.has(k)));
		}
	};

	const togglePermission = (module: ModuleAccess, key: string) => {
		if (draftGrants.includes(key)) {
			setDraftGrants(draftGrants.filter((k) => k !== key));
			return;
		}
		setDraftGrants([...draftGrants, key]);
		// Granting a permission implies access to its module.
		if (!draftModules.includes(module.key))
			setDraftModules([...draftModules, module.key]);
	};

	const save = async () => {
		setPending(true);
		try {
			await api.updateRolePermissions(role.id, draftGrants, draftModules);
			await queryClient.invalidateQueries({ queryKey: queryKeys.meta });
			toastSuccess(`Saved ${humanize(role.name)}`);
		} catch (caught) {
			toastApiError(caught, "Permissions could not be saved");
		} finally {
			setPending(false);
		}
	};

	return (
		<Card className="card--flush">
			<CardHeader
				title={<span className="matrix__role">{humanize(role.name)}</span>}
				hint={`${draftModules.length} modules · ${draftGrants.length} permissions`}
				icon={<ShieldCheck size={16} weight="regular" aria-hidden="true" />}
				actions={
					locked ? (
						<Badge tone="outline">
							{role.name === ADMIN ? "Always full access" : "Read only"}
						</Badge>
					) : (
						<Button
							variant="primary"
							size="sm"
							disabled={!dirty || pending}
							onClick={() => void save()}
						>
							{pending ? "Saving…" : "Save changes"}
						</Button>
					)
				}
			/>
			{role.name === ADMIN ? (
				<div className="card__body card__body--tight">
					<InlineNote>
						<span className="row">
							<LockKey size={15} weight="regular" aria-hidden="true" />
							The ADMIN role always holds every permission and cannot be edited.
						</span>
					</InlineNote>
				</div>
			) : null}
			<ul className="role-modules">
				{modules.map((module) => {
					const Icon = moduleIcon(module.key);
					return (
						<li key={module.key} className="role-modules__row">
							<span className="matrix__module">
								<Icon size={16} weight="regular" aria-hidden="true" />
								<span>
									<span className="matrix__module-name">{module.name}</span>
									<span className="matrix__module-key">{module.key}</span>
								</span>
							</span>
							<PermissionDropdown
								module={module}
								hasModule={
									role.name === ADMIN || draftModules.includes(module.key)
								}
								granted={
									role.name === ADMIN
										? new Set(module.permissions.map((p) => p.key))
										: grantSet
								}
								disabled={locked || pending}
								onToggleModule={(on) => toggleModule(module, on)}
								onTogglePermission={(key) => togglePermission(module, key)}
							/>
						</li>
					);
				})}
			</ul>
		</Card>
	);
}

/* --------------------------------------------------------- add role modal */

function AddRoleDialog({
	roles,
	onDismiss,
	onCreated,
}: {
	roles: Role[];
	onDismiss: () => void;
	onCreated: (id: string) => void;
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");
	const [copyFrom, setCopyFrom] = useState("");
	const [error, setError] = useState<string | undefined>();
	const [pending, setPending] = useState(false);

	const submit = async () => {
		if (!name.trim()) {
			setError("Give the role a name");
			return;
		}
		setPending(true);
		try {
			const created = await api.createRole(name.trim(), copyFrom || undefined);
			await queryClient.invalidateQueries({ queryKey: queryKeys.meta });
			toastSuccess(`Role ${humanize(created.name)} created`);
			onCreated(created.id);
		} catch (caught) {
			setError(errorMessage(caught));
			setPending(false);
		}
	};

	return (
		<Dialog
			title="Add role"
			description="Start from scratch or import the modules and permissions of an existing role."
			onDismiss={onDismiss}
			dismissible={!pending}
			footer={
				<>
					<Button onClick={onDismiss} disabled={pending}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={() => void submit()}
						disabled={pending}
					>
						{pending ? "Creating…" : "Create role"}
					</Button>
				</>
			}
		>
			<form
				className="stack"
				onSubmit={(e) => {
					e.preventDefault();
					void submit();
				}}
			>
				<TextField
					label="Role name"
					value={name}
					onChange={(value) => {
						setName(value);
						setError(undefined);
					}}
					placeholder="e.g. Librarian"
					autoFocus
					error={error}
					disabled={pending}
				/>
				<SelectField
					label="Import from"
					value={copyFrom}
					onChange={setCopyFrom}
					disabled={pending}
					options={[
						{ value: "", label: "Nothing — new empty role" },
						...roles.map((role) => ({
							value: role.id,
							label: humanize(role.name),
						})),
					]}
					hint={
						copyFrom
							? "The new role starts with a copy of this role's access."
							: "The new role starts with no modules or permissions."
					}
				/>
			</form>
		</Dialog>
	);
}

/* -------------------------------------------------------------------- page */

function AccessContent({ meta, canEdit }: { meta: Meta; canEdit: boolean }) {
	const [selectedId, setSelectedId] = useState<string>(meta.roles[0]?.id ?? "");
	const [adding, setAdding] = useState(false);
	const modules = useMemo(() => sortModules(meta.modules), [meta.modules]);
	const selected = meta.roles.find((r) => r.id === selectedId) ?? meta.roles[0];

	return (
		<>
			<PageHeader
				title="Access control"
				description="Pick a role to see its modules and set what it can do in each."
				actions={
					canEdit ? (
						<Button
							variant="primary"
							icon={<Plus size={14} weight="bold" aria-hidden="true" />}
							onClick={() => setAdding(true)}
						>
							Add role
						</Button>
					) : null
				}
			/>
			{meta.roles.length === 0 ? (
				<Card>
					<EmptyState
						icon={ShieldCheck}
						title="No roles defined"
						description="Add a role to start granting access."
					/>
				</Card>
			) : (
				<div className="access-layout">
					<Card className="card--flush">
						<nav aria-label="Roles">
							<ul className="role-list">
								{meta.roles.map((role) => (
									<li key={role.id}>
										<button
											type="button"
											className={`role-list__item${role.id === selected?.id ? " role-list__item--active" : ""}`}
											aria-current={
												role.id === selected?.id ? "true" : undefined
											}
											onClick={() => setSelectedId(role.id)}
										>
											<span className="role-list__name">
												{humanize(role.name)}
											</span>
											<span className="role-list__meta num">
												{role.name === ADMIN
													? "All access"
													: `${role.modules.length} modules · ${role.granted.length} perms`}
											</span>
										</button>
									</li>
								))}
							</ul>
						</nav>
					</Card>
					{selected ? (
						<RoleDetail role={selected} modules={modules} canEdit={canEdit} />
					) : null}
				</div>
			)}
			{adding ? (
				<AddRoleDialog
					roles={meta.roles}
					onDismiss={() => setAdding(false)}
					onCreated={(id) => {
						setAdding(false);
						setSelectedId(id);
					}}
				/>
			) : null}
		</>
	);
}

function AccessPage() {
	const { isAdmin, hasPermission } = useAuth();
	const meta = useMeta();

	if (!isAdmin && !hasPermission("users.view")) {
		return (
			<NoAccessPage
				moduleKey="users"
				label="Access control"
				body="Access control needs the users.view permission. Your role does not hold it."
			/>
		);
	}

	const canEdit = isAdmin || hasPermission("settings.manage");

	if (meta.isPending) {
		return (
			<>
				<PageHeader title="Access control" />
				<Card>
					<SkeletonStack rows={5} />
				</Card>
			</>
		);
	}
	if (meta.isError) {
		return (
			<>
				<PageHeader title="Access control" />
				<Card>
					<ErrorState
						title="Roles unavailable"
						message={errorMessage(meta.error)}
						onRetry={() => void meta.refetch()}
					/>
				</Card>
			</>
		);
	}
	return <AccessContent meta={meta.data} canEdit={canEdit} />;
}

export const accessRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/access",
	component: AccessPage,
});
