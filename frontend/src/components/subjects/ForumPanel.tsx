import {
	CaretDown,
	CaretRight,
	ChatCircle,
	LockKey,
	Plus,
	PushPin,
} from "@phosphor-icons/react";
import { useState } from "react";
import { errorMessage, type Forum, type ForumThread } from "../../api";
import { formatDateTime } from "../../format";
import {
	useForumMutations,
	useForumThreads,
	useSubjectForums,
	useThread,
} from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import {
	Badge,
	Button,
	Card,
	EmptyState,
	ErrorState,
	InlineNote,
	SkeletonStack,
	TextArea,
	TextField,
} from "../ui";

/**
 * Course forums: the lecturer starts a topic, students reply. Threads are listed
 * newest-first; opening one shows the replies and a reply box.
 */
export function ForumPanel({
	subjectId,
	userId,
	canModerate,
	canPost,
}: {
	subjectId: string;
	userId: string;
	canModerate: boolean;
	canPost: boolean;
}) {
	const forums = useSubjectForums(subjectId);
	const { createForum } = useForumMutations(subjectId);
	const [openForumId, setOpenForumId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");

	if (forums.isPending) {
		return (
			<Card>
				<SkeletonStack rows={4} />
			</Card>
		);
	}

	if (forums.isError) {
		return (
			<Card>
				<ErrorState
					title="Forums could not be loaded"
					message={errorMessage(forums.error)}
					onRetry={() => void forums.refetch()}
				/>
			</Card>
		);
	}

	const items: Forum[] = forums.data ?? [];

	return (
		<div className="stack">
			{items.length === 0 ? (
				<Card>
					<EmptyState
						icon={ChatCircle}
						title="No forum for this subject yet"
						description={
							canModerate
								? "Create one thread container, then start topics inside it. Students reply there instead of emailing you."
								: "The lecturer has not opened a discussion for this subject yet."
						}
						action={
							canModerate ? (
								<Button
									variant="primary"
									size="sm"
									onClick={() => setCreating(true)}
								>
									Create forum
								</Button>
							) : null
						}
					/>
				</Card>
			) : (
				items.map((forum) => (
					<ForumCard
						key={forum.id}
						forum={forum}
						expanded={openForumId === forum.id}
						onToggle={() =>
							setOpenForumId((current) =>
								current === forum.id ? null : forum.id,
							)
						}
						userId={userId}
						canModerate={canModerate}
						canPost={canPost}
					/>
				))
			)}

			{canModerate && items.length > 0 ? (
				<div>
					<Button
						variant="secondary"
						size="sm"
						icon={<Plus size={15} weight="bold" aria-hidden="true" />}
						onClick={() => setCreating(true)}
					>
						New forum
					</Button>
				</div>
			) : null}

			{creating ? (
				<Card>
					<div className="stack--sm">
						<TextField
							label="Forum title"
							value={title}
							onChange={setTitle}
							placeholder="Course questions"
							autoFocus
						/>
						<TextField
							label="Description"
							value={description}
							onChange={setDescription}
							hint="Optional. What belongs in this forum."
						/>
						{createForum.isError ? (
							<InlineNote>{errorMessage(createForum.error)}</InlineNote>
						) : null}
						<div className="row">
							<Button
								variant="secondary"
								onClick={() => {
									setCreating(false);
									setTitle("");
									setDescription("");
								}}
							>
								Cancel
							</Button>
							<Button
								variant="primary"
								disabled={!title.trim() || createForum.isPending}
								onClick={async () => {
									try {
										await createForum.mutateAsync({
											subjectId,
											input: {
												user_id: userId,
												title: title.trim(),
												description: description.trim() || undefined,
											},
										});
										toastSuccess("Forum created", title.trim());
										setCreating(false);
										setTitle("");
										setDescription("");
									} catch (error) {
										toastApiError(error, "Forum could not be created");
									}
								}}
							>
								Create forum
							</Button>
						</div>
					</div>
				</Card>
			) : null}
		</div>
	);
}

function ForumCard({
	forum,
	expanded,
	onToggle,
	userId,
	canModerate,
	canPost,
}: {
	forum: Forum;
	expanded: boolean;
	onToggle: () => void;
	userId: string;
	canModerate: boolean;
	canPost: boolean;
}) {
	const threads = useForumThreads(expanded ? forum.id : undefined);
	const { createThread } = useForumMutations(forum.subject_id, forum.id);
	const [openThreadId, setOpenThreadId] = useState<string | null>(null);
	const [composing, setComposing] = useState(false);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");

	return (
		<Card>
			<button
				type="button"
				className="forum__head"
				onClick={onToggle}
				aria-expanded={expanded}
			>
				<span className="forum__head-main">
					<span className="row row--tight">
						{expanded ? (
							<CaretDown size={13} weight="bold" aria-hidden="true" />
						) : (
							<CaretRight size={13} weight="bold" aria-hidden="true" />
						)}
						<span className="card__title">{forum.title}</span>
						{forum.is_locked ? (
							<Badge tone="warning">
								<LockKey size={11} weight="regular" aria-hidden="true" /> locked
							</Badge>
						) : null}
					</span>
					{forum.description ? (
						<span className="card__hint">{forum.description}</span>
					) : null}
				</span>
				<span className="row row--tight">
					<Badge tone="outline">{forum.thread_count} topics</Badge>
					<Badge tone="outline">{forum.post_count} replies</Badge>
				</span>
			</button>

			{expanded ? (
				<div className="forum__body">
					{threads.isPending ? <SkeletonStack rows={2} /> : null}
					{threads.isError ? (
						<InlineNote>{errorMessage(threads.error)}</InlineNote>
					) : null}

					{(threads.data ?? []).length === 0 && !threads.isPending ? (
						<p className="content-row__body">No topics yet.</p>
					) : null}

					{(threads.data ?? []).map((thread) => (
						<ThreadRow
							key={thread.id}
							thread={thread}
							expanded={openThreadId === thread.id}
							onToggle={() =>
								setOpenThreadId((current) =>
									current === thread.id ? null : thread.id,
								)
							}
							userId={userId}
							canPost={canPost}
						/>
					))}

					{canModerate ? (
						composing ? (
							<div className="stack--sm forum__composer">
								<TextField
									label="Topic title"
									value={title}
									onChange={setTitle}
									placeholder="How is the exam graded?"
									autoFocus
								/>
								<TextArea
									label="Opening post"
									value={body}
									onChange={setBody}
									rows={3}
									placeholder="Explain the topic so students know what to answer."
								/>
								<div className="row">
									<Button
										variant="secondary"
										onClick={() => {
											setComposing(false);
											setTitle("");
											setBody("");
										}}
									>
										Cancel
									</Button>
									<Button
										variant="primary"
										disabled={
											!title.trim() || !body.trim() || createThread.isPending
										}
										onClick={async () => {
											try {
												await createThread.mutateAsync({
													forumId: forum.id,
													input: {
														user_id: userId,
														title: title.trim(),
														body: body.trim(),
													},
												});
												toastSuccess("Topic started", title.trim());
												setComposing(false);
												setTitle("");
												setBody("");
											} catch (error) {
												toastApiError(error, "Topic could not be started");
											}
										}}
									>
										Start topic
									</Button>
								</div>
							</div>
						) : (
							<Button
								variant="secondary"
								size="sm"
								icon={<Plus size={15} weight="bold" aria-hidden="true" />}
								onClick={() => setComposing(true)}
							>
								Start topic
							</Button>
						)
					) : (
						<InlineNote>
							Only the lecturer starts topics here — reply inside a topic with
							your question.
						</InlineNote>
					)}
				</div>
			) : null}
		</Card>
	);
}

function ThreadRow({
	thread,
	expanded,
	onToggle,
	userId,
	canPost,
}: {
	thread: ForumThread;
	expanded: boolean;
	onToggle: () => void;
	userId: string;
	canPost: boolean;
}) {
	const detail = useThread(expanded ? thread.id : undefined);
	const { reply } = useForumMutations(undefined, undefined, thread.id);
	const [body, setBody] = useState("");

	return (
		<article className="thread">
			<button
				type="button"
				className="thread__head"
				onClick={onToggle}
				aria-expanded={expanded}
			>
				<span className="row row--tight">
					{expanded ? (
						<CaretDown size={12} weight="bold" aria-hidden="true" />
					) : (
						<CaretRight size={12} weight="bold" aria-hidden="true" />
					)}
					{thread.is_pinned ? (
						<PushPin size={12} weight="fill" aria-label="Pinned" />
					) : null}
					<span className="content-row__title">{thread.title}</span>
					{thread.is_locked ? (
						<Badge tone="warning">
							<LockKey size={11} weight="regular" aria-hidden="true" /> locked
						</Badge>
					) : null}
				</span>
				<span className="row row--tight">
					<span className="content-row__meta">
						{thread.author_name} · {thread.author_role.toLowerCase()} ·{" "}
						{formatDateTime(thread.created_at)}
					</span>
					<Badge tone="outline">{thread.reply_count} replies</Badge>
				</span>
			</button>

			{expanded ? (
				<div className="thread__body">
					<p className="thread__opening">{thread.body}</p>

					{detail.data?.posts.map((post) => (
						<div key={post.id} className="post">
							<p className="post__meta">
								{post.author_name} · {post.author_role.toLowerCase()} ·{" "}
								{formatDateTime(post.created_at)}
							</p>
							<p className="post__body">{post.body}</p>
						</div>
					))}

					{canPost && !thread.is_locked ? (
						<div className="stack--sm">
							<TextArea
								label="Your reply"
								value={body}
								onChange={setBody}
								rows={3}
								placeholder="Ask your question or answer the lecturer."
							/>
							<div className="row">
								<Button
									variant="primary"
									size="sm"
									disabled={!body.trim() || reply.isPending}
									onClick={async () => {
										try {
											await reply.mutateAsync({
												threadId: thread.id,
												input: { user_id: userId, body: body.trim() },
											});
											toastSuccess("Reply posted");
											setBody("");
										} catch (error) {
											toastApiError(error, "Reply could not be posted");
										}
									}}
								>
									Post reply
								</Button>
							</div>
						</div>
					) : null}
				</div>
			) : null}
		</article>
	);
}
