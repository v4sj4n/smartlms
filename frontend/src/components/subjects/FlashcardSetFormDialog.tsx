import {
	ArrowDown,
	ArrowUp,
	CircleNotch,
	Plus,
	Trash,
} from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { errorMessage, type FlashcardSet } from "../../api";
import { useSubjectMutations } from "../../queries";
import { toastApiError, toastSuccess } from "../../toast";
import { Button, Dialog, IconButton, TextArea, TextField } from "../ui";
import { WeekField } from "./WeekField";

type DraftCard = { key: string; front: string; back: string };

let nextKey = 0;
const draftCard = (front = "", back = ""): DraftCard => ({
	key: `card-${nextKey++}`,
	front,
	back,
});

/**
 * Create or edit a flashcard set: a title, an optional description and week,
 * and the deck itself — an ordered list of cards with a front and a back.
 * Saving sends the whole deck, so reordering and removing are just edits here.
 */
export function FlashcardSetFormDialog({
	subjectId,
	weekId,
	set,
	onClose,
}: {
	subjectId: string;
	/** Week the set is filed into on create, when opened from a week. */
	weekId?: string;
	set?: FlashcardSet;
	onClose: () => void;
}) {
	const { createFlashcardSet, updateFlashcardSet } =
		useSubjectMutations(subjectId);
	const isEdit = set !== undefined;

	const [title, setTitle] = useState(set?.title ?? "");
	const [description, setDescription] = useState(set?.description ?? "");
	const [week, setWeek] = useState(set?.week_id ?? weekId ?? "");
	const [cards, setCards] = useState<DraftCard[]>(() =>
		set && set.cards.length > 0
			? set.cards.map((card) => draftCard(card.front, card.back))
			: [draftCard()],
	);
	const [error, setError] = useState<string | null>(null);
	const [showErrors, setShowErrors] = useState(false);
	const listRef = useRef<HTMLOListElement>(null);

	const pending = createFlashcardSet.isPending || updateFlashcardSet.isPending;

	const updateCard = (key: string, side: "front" | "back", value: string) => {
		setError(null);
		setCards((current) =>
			current.map((card) =>
				card.key === key ? { ...card, [side]: value } : card,
			),
		);
	};

	const addCard = () => {
		setCards((current) => [...current, draftCard()]);
		// Focus the new card's front once it renders.
		requestAnimationFrame(() => {
			const areas = listRef.current?.querySelectorAll("textarea");
			areas?.[areas.length - 2]?.focus();
		});
	};

	const removeCard = (key: string) =>
		setCards((current) => current.filter((card) => card.key !== key));

	const moveCard = (index: number, offset: -1 | 1) =>
		setCards((current) => {
			const target = index + offset;
			if (target < 0 || target >= current.length) return current;
			const next = [...current];
			[next[index], next[target]] = [next[target], next[index]];
			return next;
		});

	// Fully blank rows are dropped on save; a half-filled one is a mistake.
	const filled = cards.filter((card) => card.front.trim() || card.back.trim());
	const isHalf = (card: DraftCard) =>
		Boolean(card.front.trim()) !== Boolean(card.back.trim());

	const submit = async () => {
		setShowErrors(true);
		if (!title.trim()) {
			setError("Give the set a title.");
			return;
		}
		if (filled.length === 0) {
			setError("Add at least one card with a front and a back.");
			return;
		}
		if (filled.some(isHalf)) {
			setError("Every card needs both a front and a back.");
			return;
		}
		setError(null);
		const input = {
			title: title.trim(),
			description: description.trim(),
			// Empty clears the week on edit and leaves it unscheduled on create.
			week_id: week,
			cards: filled.map((card) => ({
				front: card.front.trim(),
				back: card.back.trim(),
			})),
		};
		try {
			if (isEdit) {
				await updateFlashcardSet.mutateAsync({ id: set.id, input });
				toastSuccess("Flashcard set saved", input.title);
			} else {
				await createFlashcardSet.mutateAsync({ id: subjectId, input });
				toastSuccess("Flashcard set created", input.title);
			}
			onClose();
		} catch (caught) {
			setError(errorMessage(caught));
			toastApiError(caught, "Flashcard set could not be saved");
		}
	};

	return (
		<Dialog
			size="lg"
			title={isEdit ? "Edit flashcard set" : "New flashcard set"}
			description="A set is a deck of two-sided cards: a prompt on the front, the answer on the back."
			onDismiss={onClose}
			dismissible={!pending}
			footer={
				<>
					{error ? (
						<span className="dialog__footer-spacer form-note">{error}</span>
					) : (
						<span className="dialog__footer-spacer card__hint num">
							{filled.length} {filled.length === 1 ? "card" : "cards"}
						</span>
					)}
					<Button variant="secondary" onClick={onClose} disabled={pending}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={() => void submit()}
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
						{isEdit ? "Save set" : "Create set"}
					</Button>
				</>
			}
		>
			<div className="grid grid--2">
				<TextField
					label="Title"
					value={title}
					onChange={(next) => {
						setError(null);
						setTitle(next);
					}}
					error={showErrors && !title.trim() ? "Enter a title." : undefined}
					placeholder="Derivatives — key rules"
					autoFocus
					disabled={pending}
				/>
				<WeekField
					subjectId={subjectId}
					value={week}
					onChange={setWeek}
					disabled={pending}
				/>
			</div>
			<TextField
				label="Description"
				value={description}
				onChange={setDescription}
				placeholder="What this set helps students practise (optional)"
				disabled={pending}
			/>

			<section className="card-editor" aria-label="Cards">
				<h3 className="card-editor__title">Cards</h3>
				<ol className="card-editor__list" ref={listRef}>
					{cards.map((card, index) => (
						<li
							key={card.key}
							className={
								showErrors && isHalf(card)
									? "card-editor__card card-editor__card--error"
									: "card-editor__card"
							}
						>
							<span className="card-editor__index num" aria-hidden="true">
								{index + 1}
							</span>
							<div className="card-editor__sides">
								<TextArea
									label="Front"
									value={card.front}
									onChange={(value) => updateCard(card.key, "front", value)}
									placeholder="What is the derivative of sin x?"
									rows={2}
									disabled={pending}
								/>
								<TextArea
									label="Back"
									value={card.back}
									onChange={(value) => updateCard(card.key, "back", value)}
									placeholder="cos x"
									rows={2}
									disabled={pending}
								/>
							</div>
							<div className="card-editor__actions">
								<IconButton
									label={`Move card ${index + 1} up`}
									icon={<ArrowUp size={13} aria-hidden="true" />}
									onClick={() => moveCard(index, -1)}
									disabled={pending || index === 0}
								/>
								<IconButton
									label={`Move card ${index + 1} down`}
									icon={<ArrowDown size={13} aria-hidden="true" />}
									onClick={() => moveCard(index, 1)}
									disabled={pending || index === cards.length - 1}
								/>
								<IconButton
									label={`Remove card ${index + 1}`}
									icon={<Trash size={13} aria-hidden="true" />}
									tone="danger"
									onClick={() => removeCard(card.key)}
									disabled={pending || cards.length === 1}
								/>
							</div>
						</li>
					))}
				</ol>
				<Button
					variant="secondary"
					size="sm"
					icon={<Plus size={14} weight="bold" aria-hidden="true" />}
					onClick={addCard}
					disabled={pending}
				>
					Add card
				</Button>
			</section>
		</Dialog>
	);
}
