import { CheckCircle, CircleNotch, LockKey } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { errorMessage, type ModuleAccess } from "../../api";
import { useAuth } from "../../auth";
import { Button, Dialog, ErrorState } from "../../components/ui";
import {
	useMeta,
	useUpdateUserPermissions,
	useUserPermissions,
} from "../../queries";
import { toast, toastApiError } from "../../toast";

/**
 * Per-user permission editor. Role grants are shown as inherited, locked
 * checkboxes; the person's own overrides are ticked here on top of them.
 * Saving replaces only the extras — the role's grants never change.
 */
export function UserPermissionsDialog({
	userId,
	userName,
	onClose,
}: {
	userId: string;
	userName: string;
	onClose: () => void;
}) {
	const { session, isAdmin, hasPermission } = useAuth();
	const meta = useMeta();
	const current = useUserPermissions(userId);
	const save = useUpdateUserPermissions(userId);
	const [draft, setDraft] = useState<string[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (current.data) setDraft(current.data.extra_grants);
	}, [current.data]);

	// Admin can edit anyone; anybody else needs settings.manage (same gate as
	// role permission management).
	const editable = isAdmin || hasPermission("settings.manage");
	const roleGrants = useMemo(
		() => new Set(current.data?.role_grants ?? []),
		[current.data],
	);

	const modules: ModuleAccess[] = meta.data?.modules ?? [];
	const dirty =
		draft !== null &&
		current.data !== undefined &&
		(draft.length !== current.data.extra_grants.length ||
			draft.some((key) => !current.data!.extra_grants.includes(key)));

	const toggle = (key: string) => {
		if (!draft || !editable) return;
		setError(null);
		setDraft(
			draft.includes(key)
				? draft.filter((entry) => entry !== key)
				: [...draft, key],
		);
	};

	return (
		<Dialog
			title={`Permissions for ${userName}`}
			description="Role grants are inherited and locked here. Anything ticked below is an extra permission for this person only."
			onDismiss={onClose}
			dismissible={!save.isPending}
			footer={
				<>
					<span className="form-note">{dirty ? "Unsaved changes" : null}</span>
					<span style={{ marginLeft: "auto" }} />
					<Button variant="ghost" onClick={onClose} disabled={save.isPending}>
						Cancel
					</Button>
					<Button
						variant="primary"
						disabled={!dirty || save.isPending || !editable || draft === null}
						onClick={() => {
							if (!draft) return;
							const request = save.mutateAsync({
								permissionKeys: draft,
								grantedBy: session?.user.id ?? "",
							});
							void toast.promise(request, {
								loading: `Saving permissions for ${userName}…`,
								success: `Permissions saved for ${userName}`,
								error: (caught) => errorMessage(caught),
							});
							request.catch((caught: unknown) =>
								setError(errorMessage(caught)),
							);
						}}
					>
						{save.isPending ? (
							<CircleNotch
								size={14}
								weight="bold"
								className="spinner"
								aria-hidden="true"
							/>
						) : (
							<CheckCircle size={14} weight="regular" aria-hidden="true" />
						)}
						Save extras
					</Button>
				</>
			}
		>
			{current.isPending ? (
				<p className="models-block__empty">Loading grants…</p>
			) : current.isError ? (
				<ErrorState
					title="Permissions could not be loaded"
					message={errorMessage(current.error)}
					onRetry={() => void current.refetch()}
				/>
			) : (
				<div className="perm-groups">
					<p className="dialog-role-line">
						Role <strong>{current.data?.role}</strong> ·{" "}
						{current.data?.role_grants.length ?? 0} inherited grants ·{" "}
						{current.data?.extra_grants.length ?? 0} extras
					</p>
					{modules.map((module) => (
						<div key={module.key} className="perm-group">
							<h3 className="perm-group__title">
								{module.name}
								<span className="perm-group__key">{module.key}</span>
							</h3>
							<div className="perm-list">
								{module.permissions.map((permission) => {
									const inherited = roleGrants.has(permission.key);
									const extra = draft?.includes(permission.key) ?? false;
									const checked = inherited || extra;
									return (
										<label
											key={permission.key}
											className={[
												"perm",
												checked ? "perm--checked" : "",
												inherited ? "perm--inherited" : "",
											]
												.filter(Boolean)
												.join(" ")}
										>
											<input
												type="checkbox"
												className="perm__input"
												checked={checked}
												disabled={inherited || !editable || save.isPending}
												onChange={() => toggle(permission.key)}
											/>
											<span className="perm__text">
												<span className="perm__label">
													{permission.label}
													{inherited ? (
														<span className="perm__inherited">
															<LockKey
																size={11}
																weight="regular"
																aria-hidden="true"
															/>{" "}
															role
														</span>
													) : null}
												</span>
												<span className="perm__desc">
													{permission.description ?? permission.key}
												</span>
											</span>
										</label>
									);
								})}
							</div>
						</div>
					))}
					{error ? <p className="form-note">{error}</p> : null}
				</div>
			)}
		</Dialog>
	);
}
