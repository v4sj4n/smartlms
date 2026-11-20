import {
	ArrowLeft,
	Buildings,
	CaretRight,
	Door,
	LockKey,
	PencilSimple,
	Plus,
	Stairs,
	Trash,
	UsersThree,
} from "@phosphor-icons/react";
import { createRoute, Link } from "@tanstack/react-router";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { type Campus, type ClassRoom, errorMessage, type Story } from "../api";
import { useAuth } from "../auth";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CampusFormDialog } from "../components/campuses/CampusFormDialog";
import { ClassFormDialog } from "../components/campuses/ClassFormDialog";
import { StoryFormDialog } from "../components/campuses/StoryFormDialog";
import { ModuleGate } from "../components/ModuleGate";
import {
	Badge,
	Button,
	Card,
	Chip,
	EmptyState,
	ErrorState,
	IconButton,
	InlineNote,
	PageHeader,
	SkeletonStack,
} from "../components/ui";
import { useCampuses, useCampusMutations } from "../queries";
import { appLayoutRoute } from "./app-layout";

type DialogState =
	| { kind: "campus-create" }
	| { kind: "campus-edit"; campus: Campus }
	| { kind: "campus-delete"; campus: Campus }
	| { kind: "story-create"; campus: Campus }
	| { kind: "story-edit"; campus: Campus; story: Story }
	| { kind: "story-delete"; story: Story; floor: number }
	| { kind: "class-create"; story: Story }
	| { kind: "class-edit"; story: Story; room: ClassRoom }
	| { kind: "class-delete"; room: ClassRoom }
	| null;

/** `?campus=<id>&floor=<storyId>`: the drill-down lives in the URL so back,
 * refresh and shared links land on the same building and floor. */
type CampusSearch = { campus?: string; floor?: string };

function parseCampusSearch(search: Record<string, unknown>): CampusSearch {
	const parsed: CampusSearch = {};
	if (typeof search.campus === "string" && search.campus)
		parsed.campus = search.campus;
	if (parsed.campus && typeof search.floor === "string" && search.floor) {
		parsed.floor = search.floor;
	}
	return parsed;
}

const plural = (count: number, one: string, many: string) =>
	`${count} ${count === 1 ? one : many}`;

function roomCount(campus: Campus): number {
	return campus.stories.reduce(
		(total, story) => total + story.classes.length,
		0,
	);
}

function seatCount(story: Story): number {
	return story.classes.reduce((total, room) => total + room.capacity, 0);
}

/** Top floor first, the way a building reads. */
function floorsTopDown(campus: Campus): Story[] {
	return [...campus.stories].sort((left, right) => right.floor - left.floor);
}

function floorTitle(story: Story): string {
	return story.name
		? `Floor ${story.floor} · ${story.name}`
		: `Floor ${story.floor}`;
}

/** A row of windows: one lit pane per room, padded with dark panes so even an
 * empty floor still looks like a floor. */
function Windows({
	rooms,
	min,
	max,
}: {
	rooms: number;
	min: number;
	max: number;
}) {
	const shown = Math.min(Math.max(rooms, min), max);
	return (
		<span className="building__windows" aria-hidden="true">
			{Array.from({ length: shown }, (_, index) => (
				<span
					key={index}
					className={[
						"building__window",
						index < rooms ? "building__window--lit" : "",
					].join(" ")}
				/>
			))}
			{rooms > max ? (
				<span className="building__more num">+{rooms - max}</span>
			) : null}
		</span>
	);
}

/** Decorative building for the overview grid: one band per story. */
function BuildingThumb({ campus }: { campus: Campus }) {
	const floors = floorsTopDown(campus);
	return (
		<span
			className="building building--thumb"
			aria-hidden="true"
			style={{ "--floors": Math.max(floors.length, 1) } as CSSProperties}
		>
			<span className="building__roof" />
			<span className="building__body">
				{floors.length === 0 ? (
					<span className="building__floor building__floor--empty" />
				) : (
					floors.map((story, index) => (
						<span className="building__floor" key={story.id}>
							<Windows rooms={story.classes.length} min={4} max={6} />
							{index === floors.length - 1 ? (
								<span className="building__door" />
							) : null}
						</span>
					))
				)}
			</span>
			<span className="building__ground" />
		</span>
	);
}

function CampusOverview({ campuses }: { campuses: Campus[] }) {
	return (
		<ul className="campus-grid" aria-label="Campuses">
			{campuses.map((campus) => {
				const rooms = roomCount(campus);
				return (
					<li key={campus.id}>
						<Link
							to="/campuses"
							search={{ campus: campus.id }}
							className="campus-tile"
						>
							<span className="campus-tile__scene">
								<BuildingThumb campus={campus} />
							</span>
							<span className="campus-tile__text">
								<span className="campus-tile__name">{campus.name}</span>
								<span className="campus-tile__address">
									{campus.address ?? "No address recorded"}
								</span>
								<span className="campus-tile__meta num">
									{plural(campus.stories.length, "floor", "floors")} ·{" "}
									{plural(rooms, "class", "classes")}
								</span>
							</span>
							<CaretRight
								size={16}
								weight="bold"
								aria-hidden="true"
								className="campus-tile__caret"
							/>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}

function RoomRow({
	room,
	story,
	campusName,
	canManage,
	onEdit,
	onDelete,
}: {
	room: ClassRoom;
	story: Story;
	campusName: string;
	canManage: boolean;
	onEdit: () => void;
	onDelete: () => void;
}) {
	return (
		<li className="class-row">
			<span className="class-row__icon" aria-hidden="true">
				<Door size={18} weight="regular" />
			</span>
			<div className="class-row__main">
				<p className="class-row__name">{room.name}</p>
				<div className="class-row__tags">
					{room.tags.length === 0 ? (
						<span className="table__secondary">No tags</span>
					) : (
						room.tags.map((tag) => (
							<Chip key={tag} tone="muted">
								{tag}
							</Chip>
						))
					)}
				</div>
			</div>
			<span className="class-row__seats num">
				<UsersThree size={14} weight="regular" aria-hidden="true" />
				{plural(room.capacity, "seat", "seats")}
			</span>
			{canManage ? (
				<div className="class-row__actions">
					<IconButton
						label={`Edit ${room.name} on floor ${story.floor} in ${campusName}`}
						icon={
							<PencilSimple size={14} weight="regular" aria-hidden="true" />
						}
						onClick={onEdit}
					/>
					<IconButton
						label={`Delete ${room.name} on floor ${story.floor} in ${campusName}`}
						icon={<Trash size={14} weight="regular" aria-hidden="true" />}
						tone="danger"
						onClick={onDelete}
					/>
				</div>
			) : null}
		</li>
	);
}

function FloorPanel({
	campus,
	story,
	canManage,
	onDialog,
}: {
	campus: Campus;
	story: Story;
	canManage: boolean;
	onDialog: (dialog: DialogState) => void;
}) {
	const rooms = story.classes;
	return (
		<Card className="floor-panel">
			<header className="floor-panel__head">
				<div className="floor-panel__identity">
					<span className="floor-panel__badge num" aria-hidden="true">
						{story.floor}
					</span>
					<div>
						<h2 className="floor-panel__title">{floorTitle(story)}</h2>
						<p className="floor-panel__meta num">
							{plural(rooms.length, "class", "classes")} ·{" "}
							{plural(seatCount(story), "seat", "seats")}
						</p>
					</div>
				</div>
				{canManage ? (
					<div className="card__actions">
						<Button
							size="sm"
							icon={<Plus size={14} weight="bold" aria-hidden="true" />}
							onClick={() => onDialog({ kind: "class-create", story })}
						>
							Add class
						</Button>
						<IconButton
							label={`Edit floor ${story.floor} in ${campus.name}`}
							icon={
								<PencilSimple size={15} weight="regular" aria-hidden="true" />
							}
							onClick={() => onDialog({ kind: "story-edit", campus, story })}
						/>
						<IconButton
							label={`Delete floor ${story.floor} in ${campus.name}`}
							icon={<Trash size={15} weight="regular" aria-hidden="true" />}
							tone="danger"
							onClick={() =>
								onDialog({ kind: "story-delete", story, floor: story.floor })
							}
						/>
					</div>
				) : null}
			</header>

			{rooms.length === 0 ? (
				<EmptyState
					icon={Door}
					title="No classes on this floor"
					description={
						canManage
							? "Add the first class to start scheduling rooms here."
							: "Classes appear here once an administrator adds them."
					}
				/>
			) : (
				<ul
					className="class-list"
					aria-label={`Classes on floor ${story.floor}`}
				>
					{rooms.map((room) => (
						<RoomRow
							key={room.id}
							room={room}
							story={story}
							campusName={campus.name}
							canManage={canManage}
							onEdit={() => onDialog({ kind: "class-edit", story, room })}
							onDelete={() => onDialog({ kind: "class-delete", room })}
						/>
					))}
				</ul>
			)}
		</Card>
	);
}

function CampusDetail({
	campus,
	floorId,
	canManage,
	onDialog,
}: {
	campus: Campus;
	floorId?: string;
	canManage: boolean;
	onDialog: (dialog: DialogState) => void;
}) {
	const floors = floorsTopDown(campus);
	const selected = floors.find((story) => story.id === floorId);
	const panelRef = useRef<HTMLDivElement>(null);

	// On phones the class list sits below the building: bring it into view
	// when a floor is picked.
	useEffect(() => {
		if (!selected || !window.matchMedia("(max-width: 880px)").matches) return;
		const reduce = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		panelRef.current?.scrollIntoView({
			block: "start",
			behavior: reduce ? "auto" : "smooth",
		});
	}, [selected?.id]);

	return (
		<div className="campus-view">
			<div className="campus-view__layout">
				<section className="tower" aria-label={`${campus.name} floors`}>
					<div className="building building--interactive">
						<span className="building__roof" aria-hidden="true" />
						{floors.length === 0 ? (
							<div className="building__body">
								<p className="building__floor building__floor--empty building__empty-text">
									No floors yet
								</p>
							</div>
						) : (
							<ol className="building__body" aria-label="Floors, top to bottom">
								{floors.map((story) => {
									const active = story.id === selected?.id;
									return (
										<li key={story.id}>
											<Link
												to="/campuses"
												search={{ campus: campus.id, floor: story.id }}
												replace={Boolean(selected)}
												className={[
													"building__floor",
													active ? "building__floor--active" : "",
												].join(" ")}
												aria-current={active ? "true" : undefined}
											>
												<span className="building__level num">
													{story.floor}
												</span>
												<span className="building__floor-text">
													<span className="building__floor-name">
														{story.name || `Floor ${story.floor}`}
													</span>
													<span className="building__floor-meta num">
														{plural(story.classes.length, "class", "classes")}
													</span>
												</span>
												<Windows rooms={story.classes.length} min={3} max={6} />
											</Link>
										</li>
									);
								})}
							</ol>
						)}
						<span className="building__ground" aria-hidden="true" />
					</div>
				</section>

				<div ref={panelRef} className="campus-view__panel">
					{selected ? (
						<FloorPanel
							campus={campus}
							story={selected}
							canManage={canManage}
							onDialog={onDialog}
						/>
					) : (
						<Card className="floor-panel">
							<EmptyState
								icon={Stairs}
								title={
									floors.length === 0
										? "This building has no floors"
										: "Pick a floor"
								}
								description={
									floors.length === 0
										? canManage
											? "Add a floor, then add the classes on it."
											: "Floors appear here once an administrator adds them."
										: "Choose a floor in the building to see its classes."
								}
								action={
									floors.length === 0 && canManage ? (
										<Button
											variant="primary"
											size="sm"
											icon={<Plus size={15} weight="bold" aria-hidden="true" />}
											onClick={() => onDialog({ kind: "story-create", campus })}
										>
											Add floor
										</Button>
									) : null
								}
							/>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}

function CampusesContent() {
	const campuses = useCampuses();
	const { hasPermission } = useAuth();
	const { deleteCampus, deleteStory, deleteClass } = useCampusMutations();
	const [dialog, setDialog] = useState<DialogState>(null);
	const canManage = hasPermission("campuses.manage");
	const search = campusesRoute.useSearch();
	// An id that no longer exists (deleted, or a stale link) falls back to the
	// overview instead of an error.
	const selectedCampus = campuses.data?.find(
		(campus) => campus.id === search.campus,
	);

	const close = () => setDialog(null);

	return (
		<>
			{selectedCampus ? (
				<Link to="/campuses" className="back-link">
					<ArrowLeft size={14} weight="bold" aria-hidden="true" />
					All campuses
				</Link>
			) : null}

			<PageHeader
				title={selectedCampus?.name ?? "Campuses"}
				description={
					selectedCampus
						? `${selectedCampus.address ?? "No address recorded"} · ${plural(
								selectedCampus.stories.length,
								"floor",
								"floors",
							)} · ${plural(roomCount(selectedCampus), "class", "classes")}`
						: "Pick a building to walk its floors and classes."
				}
				actions={
					!canManage ? (
						<Badge
							tone="outline"
							icon={<LockKey size={12} weight="regular" aria-hidden="true" />}
						>
							View only
						</Badge>
					) : selectedCampus ? (
						<div className="card__actions">
							<Button
								size="sm"
								icon={<Plus size={14} weight="bold" aria-hidden="true" />}
								onClick={() =>
									setDialog({ kind: "story-create", campus: selectedCampus })
								}
							>
								Add floor
							</Button>
							<IconButton
								label={`Edit ${selectedCampus.name}`}
								icon={
									<PencilSimple size={15} weight="regular" aria-hidden="true" />
								}
								onClick={() =>
									setDialog({ kind: "campus-edit", campus: selectedCampus })
								}
							/>
							<IconButton
								label={`Delete ${selectedCampus.name}`}
								icon={<Trash size={15} weight="regular" aria-hidden="true" />}
								tone="danger"
								onClick={() =>
									setDialog({ kind: "campus-delete", campus: selectedCampus })
								}
							/>
						</div>
					) : (
						<Button
							variant="primary"
							size="sm"
							icon={<Plus size={15} weight="bold" aria-hidden="true" />}
							onClick={() => setDialog({ kind: "campus-create" })}
						>
							Add campus
						</Button>
					)
				}
			/>

			{!canManage ? (
				<Card>
					<InlineNote>
						Your role can view campuses but not change them. Adding and editing
						needs the <code>campuses.manage</code> permission.
					</InlineNote>
				</Card>
			) : null}

			{campuses.isPending ? (
				<div className="stack">
					<Card>
						<SkeletonStack rows={3} />
					</Card>
					<Card>
						<SkeletonStack rows={4} />
					</Card>
				</div>
			) : campuses.isError ? (
				<Card>
					<ErrorState
						title="Campuses could not be loaded"
						message={errorMessage(campuses.error)}
						onRetry={() => void campuses.refetch()}
					/>
				</Card>
			) : campuses.data.length === 0 ? (
				<Card>
					<EmptyState
						icon={Buildings}
						title="No campuses yet — add your first campus"
						description={
							canManage
								? "Campuses hold stories, and stories hold rooms. Start with a campus, then add its floors."
								: "Once an administrator adds a campus it appears here with its stories and rooms."
						}
						action={
							canManage ? (
								<Button
									variant="primary"
									size="sm"
									icon={<Plus size={15} weight="bold" aria-hidden="true" />}
									onClick={() => setDialog({ kind: "campus-create" })}
								>
									Add campus
								</Button>
							) : null
						}
					/>
				</Card>
			) : selectedCampus ? (
				<CampusDetail
					campus={selectedCampus}
					floorId={search.floor}
					canManage={canManage}
					onDialog={setDialog}
				/>
			) : (
				<CampusOverview campuses={campuses.data} />
			)}

			{dialog?.kind === "campus-create" ? (
				<CampusFormDialog onClose={close} />
			) : null}

			{dialog?.kind === "campus-edit" ? (
				<CampusFormDialog campus={dialog.campus} onClose={close} />
			) : null}

			{dialog?.kind === "campus-delete" ? (
				<ConfirmDialog
					title={`Delete ${dialog.campus.name}?`}
					description="The campus and everything inside it is removed."
					consequences={
						<>
							This deletes <strong>{dialog.campus.stories.length}</strong>{" "}
							stories and <strong>{roomCount(dialog.campus)}</strong> rooms.
							This cannot be undone.
						</>
					}
					confirmLabel="Delete campus"
					successMessage="Campus deleted"
					onConfirm={() => deleteCampus.mutateAsync(dialog.campus.id)}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "story-create" ? (
				<StoryFormDialog campus={dialog.campus} onClose={close} />
			) : null}

			{dialog?.kind === "story-edit" ? (
				<StoryFormDialog
					campus={dialog.campus}
					story={dialog.story}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "story-delete" ? (
				<ConfirmDialog
					title={`Delete floor ${dialog.floor}?`}
					description="The story and every room on it is removed."
					consequences={
						<>
							This deletes <strong>{dialog.story.classes.length}</strong> rooms
							from floor {dialog.floor}. This cannot be undone.
						</>
					}
					confirmLabel="Delete story"
					successMessage="Story deleted"
					onConfirm={() => deleteStory.mutateAsync(dialog.story.id)}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "class-create" ? (
				<ClassFormDialog story={dialog.story} onClose={close} />
			) : null}

			{dialog?.kind === "class-edit" ? (
				<ClassFormDialog
					story={dialog.story}
					room={dialog.room}
					onClose={close}
				/>
			) : null}

			{dialog?.kind === "class-delete" ? (
				<ConfirmDialog
					title={`Delete ${dialog.room.name}?`}
					description="The room is removed from its story."
					confirmLabel="Delete room"
					successMessage="Room deleted"
					onConfirm={() => deleteClass.mutateAsync(dialog.room.id)}
					onClose={close}
				/>
			) : null}
		</>
	);
}

function CampusesPage() {
	return (
		<ModuleGate moduleKey="campuses">
			<CampusesContent />
		</ModuleGate>
	);
}

export const campusesRoute = createRoute({
	getParentRoute: () => appLayoutRoute,
	path: "/campuses",
	validateSearch: parseCampusSearch,
	component: CampusesPage,
});
