import { CircleNotch, Warning } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { errorMessage } from "../api";
import { toastApiError, toastSuccess } from "../toast";
import { Button, Dialog } from "./ui";

/**
 * Destructive confirmation. The action and its toast live here so every delete
 * reports its outcome once, in the same place.
 */
export function ConfirmDialog({
	title,
	description,
	consequences,
	confirmLabel,
	successMessage,
	onConfirm,
	onClose,
}: {
	title: string;
	description: string;
	consequences?: ReactNode;
	confirmLabel: string;
	successMessage: string;
	onConfirm: () => Promise<unknown>;
	onClose: () => void;
}) {
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const confirm = async () => {
		setPending(true);
		setError(null);
		try {
			await onConfirm();
			toastSuccess(successMessage);
			onClose();
		} catch (caught) {
			setError(errorMessage(caught));
			toastApiError(caught, `${title} failed`);
		} finally {
			setPending(false);
		}
	};

	return (
		<Dialog
			title={title}
			description={description}
			onDismiss={onClose}
			dismissible={!pending}
			footer={
				<>
					<Button variant="secondary" onClick={onClose} disabled={pending}>
						Cancel
					</Button>
					<Button
						variant="danger"
						onClick={() => void confirm()}
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
								<Warning size={14} weight="regular" aria-hidden="true" />
							)
						}
					>
						{confirmLabel}
					</Button>
				</>
			}
		>
			<div className="state">
				<span className="state__icon">
					<Warning size={18} weight="regular" aria-hidden="true" />
				</span>
				<div className="state__body">
					{consequences ?? "This action cannot be undone."}
				</div>
			</div>
			{error ? <p className="form-note">{error}</p> : null}
		</Dialog>
	);
}
