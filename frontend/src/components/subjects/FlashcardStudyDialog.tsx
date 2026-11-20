import {
	ArrowCounterClockwise,
	CaretLeft,
	CaretRight,
	Shuffle,
} from "@phosphor-icons/react";
import { useState } from "react";
import type { Flashcard, FlashcardSet } from "../../api";
import { Button, Dialog } from "../ui";

const shuffled = (cards: Flashcard[]) => {
	const next = [...cards];
	for (let i = next.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[next[i], next[j]] = [next[j], next[i]];
	}
	return next;
};

/**
 * Study a set one card at a time: the front shows first, a click (or Space)
 * turns it over, and the arrows (or ←/→) move through the deck.
 */
export function FlashcardStudyDialog({
	set,
	onClose,
}: {
	set: FlashcardSet;
	onClose: () => void;
}) {
	const [deck, setDeck] = useState(set.cards);
	const [index, setIndex] = useState(0);
	const [flipped, setFlipped] = useState(false);

	const card = deck[index];
	const last = deck.length - 1;

	const go = (next: number) => {
		if (next < 0 || next > last) return;
		setIndex(next);
		setFlipped(false);
	};

	const restart = (cards: Flashcard[]) => {
		setDeck(cards);
		setIndex(0);
		setFlipped(false);
	};

	return (
		<Dialog
			size="lg"
			title={set.title}
			description={set.description || "Click the card to turn it over."}
			onDismiss={onClose}
			footer={
				<>
					<span className="dialog__footer-spacer row row--tight">
						<Button
							variant="ghost"
							size="sm"
							icon={<Shuffle size={14} aria-hidden="true" />}
							onClick={() => restart(shuffled(set.cards))}
							disabled={deck.length < 2}
						>
							Shuffle
						</Button>
						<Button
							variant="ghost"
							size="sm"
							icon={<ArrowCounterClockwise size={14} aria-hidden="true" />}
							onClick={() => restart(set.cards)}
						>
							Restart
						</Button>
					</span>
					<Button variant="secondary" onClick={onClose}>
						Done
					</Button>
				</>
			}
		>
			{card ? (
				<div
					className="study"
					onKeyDown={(event) => {
						if (event.key === "ArrowRight") go(index + 1);
						if (event.key === "ArrowLeft") go(index - 1);
					}}
				>
					<button
						type="button"
						className={flipped ? "flip-card flip-card--flipped" : "flip-card"}
						onClick={() => setFlipped((current) => !current)}
						aria-label={
							flipped
								? `Back: ${card.back}. Click to show the front.`
								: `Front: ${card.front}. Click to show the answer.`
						}
						// biome-ignore lint/a11y/noAutofocus: the deck is the dialog's purpose
						autoFocus
					>
						<span className="flip-card__inner">
							<span className="flip-card__face flip-card__face--front">
								<span className="flip-card__side">Front</span>
								<span className="flip-card__text">{card.front}</span>
							</span>
							<span className="flip-card__face flip-card__face--back">
								<span className="flip-card__side">Back</span>
								<span className="flip-card__text">{card.back}</span>
							</span>
						</span>
					</button>

					<div className="study__nav">
						<Button
							variant="secondary"
							size="sm"
							icon={<CaretLeft size={13} weight="bold" aria-hidden="true" />}
							onClick={() => go(index - 1)}
							disabled={index === 0}
						>
							Previous
						</Button>
						<span className="study__progress num" aria-live="polite">
							Card {index + 1} of {deck.length}
						</span>
						<Button
							variant="secondary"
							size="sm"
							onClick={() => go(index + 1)}
							disabled={index === last}
						>
							Next
							<CaretRight size={13} weight="bold" aria-hidden="true" />
						</Button>
					</div>
					<div
						className="study__bar"
						role="progressbar"
						aria-label="Progress through the set"
						aria-valuemin={1}
						aria-valuemax={deck.length}
						aria-valuenow={index + 1}
					>
						<span
							className="study__bar-fill"
							style={{ width: `${((index + 1) / deck.length) * 100}%` }}
						/>
					</div>
				</div>
			) : (
				<p className="card__hint">This set has no cards yet.</p>
			)}
		</Dialog>
	);
}
