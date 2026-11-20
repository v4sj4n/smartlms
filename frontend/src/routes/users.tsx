import {
	LockKey,
	ShieldCheck,
	ShieldSlash,
	UsersThree,
} from "@phosphor-icons/react";
import { createRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { errorMessage } from "../api";
import { useAuth } from "../auth";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { AccessGate } from "../components/ModuleGate";
import {
	Badge,
	type BadgeTone,
	Card,
	EmptyState,
	ErrorState,
	IconButton,
	PageHeader,
	type PageSize,
	Pagination,
	SearchField,
	SegmentedFilter,
	SkeletonStack,
	Table,
	Td,
	Th,
} from "../components/ui";
import { UserPermissionsDialog } from "../components/users/UserPermissionsDialog";
import { formatDateTime } from "../format";
import { useResetUserTwoFactor, useUsers } from "../queries";
import { DEFAULT_PAGE_SIZE, type ListSearch, parseListSearch } from "../search";
import { appLayoutRoute } from "./app-layout";

const ROLE_TONE: Record<string, BadgeTone> = {
	ADMIN: "primary",
	LECTURER: "neutral",
	STUDENT: "outline",
};

type RoleFilter = "all" | "ADMIN" | "LECTURER" | "STUDENT";
type UsersSearch = Partial<ListSearch> & {
	search?: string;
	role?: Exclude<RoleFilter, "all">;
};

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
	{ value: "all", label: "Everyone" },
	{ value: "STUDENT", label: "Students" },
	{ value: "LECTURER", label: "Lecturers" },
	{ value: "ADMIN", label: "Admins" },
];

/** Paging plus the free-text search and role filter, all kept in the URL. */
function parseUsersSearch(search: Record<string, unknown>): UsersSearch {
	const parsed: UsersSearch = parseListSearch(search);
	if (typeof search.search === "string" && search.search.trim()) {
		parsed.search = search.search.trim();
	}
	if (
		search.role === "ADMIN" ||
		search.role === "LECTURER" ||
		search.role === "STUDENT"
	) {
		parsed.role = search.role;
	}
	return parsed;
}

function UsersPage() {
	const {
		page = 1,
		page_size = DEFAULT_PAGE_SIZE,
		search = "",
		role,
	} = usersRoute.useSearch();
	const navigate = useNavigate();
	const users = useUsers({
		page,
		page_size,
		search: search || undefined,
		role,
	});

	const setFilter = (next: Pick<UsersSearch, "search" | "role">) => {
		void navigate({
			to: "/users",
			search: (previous: UsersSearch) => ({ ...previous, ...next, page: 1 }),
			replace: true,
		});
	};
	const { isAdmin } = useAuth();
	const resetTwoFactor = useResetUserTwoFactor();
	const [permsUser, setPermsUser] = useState<{
		id: string;
		name: string;
	} | null>(null);
	// Two-factor reset is an administrator's rescue path for an account that lost
	// both the authenticator app and its recovery codes.
	const [resetUser, setResetUser] = useState<{
		id: string;
		name: string;
	} | null>(null);

	const goToPage = (next: number) => {
		void navigate({
			to: "/users",
			search: (previous: Partial<ListSearch>) => ({
				...previous,
				page: Math.max(1, next),
			}),
		});
	};

	const setPageSize = (size: PageSize) => {
		void navigate({
			to: "/users",
			search: (previous: Partial<ListSearch>) => ({
				...previous,
				page: 1,
				page_size: size,
			}),
		});
	};

	return (
		<AccessGate moduleKey="users" permissionKey="users.view" label="Users">
			<PageHeader
				title="Users"
				description="Every account. The role decides which modules and permissions a person gets."
			/>

			<Card className="card--flush">
				<div className="list-toolbar">
					<SearchField
						label="Search users"
						placeholder="Search by name or email"
						value={search}
						onChange={(value) => setFilter({ search: value || undefined })}
					/>
					<SegmentedFilter
						label="Filter by role"
						value={role ?? "all"}
						options={ROLE_FILTERS}
						onChange={(value) =>
							setFilter({ role: value === "all" ? undefined : value })
						}
					/>
				</div>
				{users.isPending ? (
					<div className="card__body">
						<SkeletonStack rows={4} />
					</div>
				) : users.isError ? (
					<ErrorState
						title="Users could not be loaded"
						message={errorMessage(users.error)}
						onRetry={() => void users.refetch()}
					/>
				) : users.data.items.length === 0 ? (
					<EmptyState
						icon={UsersThree}
						title={search || role ? "No users match" : "No users on this page"}
						description={
							search || role
								? "Try another name, or show everyone."
								: "Nothing matched this page. Move back to page 1 to see the list."
						}
					/>
				) : (
					<Table caption="Users, their roles, two-factor state and lock state">
						<thead>
							<tr>
								<Th>Name</Th>
								<Th>Email</Th>
								<Th>Role</Th>
								<Th align="right">Failed attempts</Th>
								<Th>Two-factor</Th>
								<Th>Status</Th>
								<Th align="right">Access</Th>
							</tr>
						</thead>
						<tbody>
							{users.data.items.map((user) => (
								<tr key={user.id}>
									<Td>
										<span className="table__primary">{user.name}</span>
									</Td>
									<Td>
										<span className="table__secondary">{user.email}</span>
									</Td>
									<Td>
										<Badge tone={ROLE_TONE[user.role] ?? "outline"}>
											{user.role}
										</Badge>
									</Td>
									<Td align="right">
										<span className="table__num-cell num">
											{user.failed_login_attempts}
										</span>
									</Td>
									<Td>
										{user.two_factor_enabled ? (
											<span className="table__inline">
												<Badge
													tone="success"
													icon={
														<ShieldCheck
															size={12}
															weight="regular"
															aria-hidden="true"
														/>
													}
												>
													On
												</Badge>
												{isAdmin ? (
													<IconButton
														label={`Reset two-factor for ${user.name}`}
														icon={
															<ShieldSlash
																size={15}
																weight="regular"
																aria-hidden="true"
															/>
														}
														onClick={() =>
															setResetUser({ id: user.id, name: user.name })
														}
													/>
												) : null}
											</span>
										) : (
											<span className="table__secondary">Off</span>
										)}
									</Td>
									<Td>
										{user.locked_until ? (
											<Badge
												tone="error"
												icon={
													<LockKey
														size={12}
														weight="regular"
														aria-hidden="true"
													/>
												}
												title={`Locked until ${formatDateTime(user.locked_until)}`}
											>
												Locked
											</Badge>
										) : (
											<span className="table__secondary">Active</span>
										)}
									</Td>
									<Td align="right">
										<IconButton
											label={`Edit permissions for ${user.name}`}
											icon={
												<ShieldCheck
													size={15}
													weight="regular"
													aria-hidden="true"
												/>
											}
											onClick={() =>
												setPermsUser({ id: user.id, name: user.name })
											}
										/>
									</Td>
								</tr>
							))}
						</tbody>
					</Table>
				)}

				{users.data ? (
					<div className="card__footer">
						<Pagination
							page={page}
							pageSize={page_size}
							total={users.data.total}
							itemLabel="users"
							onPageChange={goToPage}
							onPageSizeChange={setPageSize}
						/>
					</div>
				) : null}
			</Card>

			{resetUser ? (
				<ConfirmDialog
					title={`Reset two-factor for ${resetUser.name}`}
					description="The account's authenticator secret and recovery codes are deleted. The password stays as it is."
					consequences={
						<span>
							Only do this when the person has lost access to their codes too:
							until they set two-factor up again, their password alone signs
							them in.
						</span>
					}
					confirmLabel="Reset two-factor"
					successMessage={`Two-factor cleared for ${resetUser.name}`}
					onConfirm={() => resetTwoFactor.mutateAsync(resetUser.id)}
					onClose={() => setResetUser(null)}
				/>
			) : null}

			{permsUser ? (
				<UserPermissionsDialog
					userId={permsUser.id}
					userName={permsUser.name}
					onClose={() => setPermsUser(null)}
				/>
			) : null}
		</AccessGate>
	);
}

export const usersRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/users",
	validateSearch: parseUsersSearch,
	component: UsersPage,
});
