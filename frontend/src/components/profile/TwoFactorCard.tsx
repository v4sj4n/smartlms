import {
	CheckCircle,
	CircleNotch,
	Copy,
	DownloadSimple,
	Key,
	QrCode,
	ShieldCheck,
	ShieldSlash,
	WarningCircle,
} from "@phosphor-icons/react";
import { toDataURL } from "qrcode";
import { useEffect, useState } from "react";
import { errorMessage, type TwoFactorSetup } from "../../api";
import { formatDateTime } from "../../format";
import { useTwoFactor, useTwoFactorMutations } from "../../queries";
import { toastError, toastSuccess } from "../../toast";
import {
	Badge,
	Button,
	Card,
	CardHeader,
	Dialog,
	ErrorState,
	InlineNote,
	SkeletonStack,
	TextField,
} from "../ui";

/** The secret in groups of four, which is how people read it off a screen. */
function groupedSecret(secret: string): string {
	return secret.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * The QR code for the otpauth URI, drawn in the browser. Nothing is uploaded:
 * the secret only ever travels between this tab and our own backend.
 */
function SetupQrCode({ uri, account }: { uri: string; account: string }) {
	const [src, setSrc] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setFailed(false);
		setSrc(null);
		void toDataURL(uri, {
			margin: 1,
			width: 200,
			// QR codes are read by hardware, not by us: pure black on pure white is
			// the standard, and it must not follow the theme.
			color: { dark: "#000000ff", light: "#ffffffff" },
		})
			.then((url) => {
				if (!cancelled) setSrc(url);
			})
			.catch(() => {
				if (!cancelled) setFailed(true);
			});
		return () => {
			cancelled = true;
		};
	}, [uri]);

	if (failed) {
		return (
			<InlineNote>
				The QR code could not be drawn here. Add the account with the key below
				instead.
			</InlineNote>
		);
	}
	if (!src) {
		return <div className="qr-frame qr-frame--empty" aria-hidden="true" />;
	}
	return (
		<div className="qr-frame">
			<img
				src={src}
				width={200}
				height={200}
				alt={`QR code for adding ${account} to an authenticator app`}
			/>
		</div>
	);
}

/** One-time list of recovery codes with copy and download, shown once. */
function RecoveryCodes({ codes }: { codes: string[] }) {
	const [copied, setCopied] = useState(false);
	const text = codes.join("\n");

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			toastSuccess("Recovery codes copied", "Paste them somewhere safe now.");
		} catch {
			toastError("Could not copy", "Select the codes and copy them by hand.");
		}
	};

	const download = () => {
		const body = [
			"SmartLMS recovery codes",
			"",
			"Each code signs you in once, when the authenticator app is not available.",
			"",
			...codes,
			"",
		].join("\n");
		const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = "smartlms-recovery-codes.txt";
		link.click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="stack--sm">
			<div className="alert alert--warning" role="note">
				<span className="alert__icon">
					<WarningCircle size={16} weight="regular" aria-hidden="true" />
				</span>
				<div className="alert__body">
					<p className="alert__title">Save these now</p>
					<p className="alert__text">
						They are shown once and never again. Store them away from the phone
						that holds your authenticator app.
					</p>
				</div>
			</div>

			<ul className="recovery-codes">
				{codes.map((code) => (
					<li key={code}>
						<code>{code}</code>
					</li>
				))}
			</ul>

			<div className="recovery-actions">
				<Button
					variant="secondary"
					size="sm"
					onClick={() => void copy()}
					icon={
						copied ? (
							<CheckCircle size={14} weight="fill" aria-hidden="true" />
						) : (
							<Copy size={14} weight="regular" aria-hidden="true" />
						)
					}
				>
					{copied ? "Copied" : "Copy all"}
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={download}
					icon={
						<DownloadSimple size={14} weight="regular" aria-hidden="true" />
					}
				>
					Download .txt
				</Button>
			</div>
		</div>
	);
}

/**
 * Enrolment: scan the code, confirm with one code from the app, then save the
 * recovery codes. The secret was minted by the backend when this dialog opened,
 * so closing early simply leaves the account with nothing enabled.
 */
function SetupDialog({
	userId,
	payload,
	onClose,
}: {
	userId: string;
	payload: TwoFactorSetup;
	onClose: () => void;
}) {
	const { enable } = useTwoFactorMutations(userId);
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

	const confirm = async () => {
		setError(null);
		try {
			const enabled = await enable.mutateAsync(code.trim());
			setRecoveryCodes(enabled.recovery_codes);
			toastSuccess("Two-factor is on", "Sign-ins now ask for a code.");
		} catch (caught) {
			setError(errorMessage(caught));
		}
	};

	if (recoveryCodes) {
		return (
			<Dialog
				title="Save your recovery codes"
				description="These are the way back in when the authenticator app is lost. Each one works once."
				onDismiss={onClose}
				footer={
					<Button variant="primary" onClick={onClose}>
						I have saved them
					</Button>
				}
			>
				<RecoveryCodes codes={recoveryCodes} />
			</Dialog>
		);
	}

	return (
		<Dialog
			title="Set up two-factor authentication"
			description="Scan the code with an authenticator app, then enter the six digits it shows."
			onDismiss={onClose}
			dismissible={!enable.isPending}
			footer={
				<>
					<span className="form-note">{error}</span>
					<span style={{ marginLeft: "auto" }} />
					<Button variant="ghost" onClick={onClose} disabled={enable.isPending}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={() => void confirm()}
						disabled={enable.isPending || code.replace(/\D/g, "").length !== 6}
						icon={
							enable.isPending ? (
								<CircleNotch
									size={14}
									weight="bold"
									className="spinner"
									aria-hidden="true"
								/>
							) : null
						}
					>
						{enable.isPending ? "Checking…" : "Turn on"}
					</Button>
				</>
			}
		>
			<div className="twofa-setup">
				<SetupQrCode uri={payload.otpauth_uri} account={payload.account} />

				<div className="twofa-setup__steps">
					<p className="page-header__description">
						1. Scan this with Google Authenticator, 1Password, Authy or any app
						that speaks TOTP.
					</p>

					<div className="setup-key">
						<span className="setup-key__label">Or enter this key by hand</span>
						<code className="setup-key__value">
							{groupedSecret(payload.secret)}
						</code>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								void navigator.clipboard
									.writeText(payload.secret)
									.then(() => toastSuccess("Setup key copied"))
									.catch(() => toastError("Could not copy the key"));
							}}
							icon={<Copy size={13} weight="regular" aria-hidden="true" />}
						>
							Copy
						</Button>
					</div>

					<p className="field__description">
						Account {payload.account} · {payload.digits} digits every{" "}
						{payload.period} seconds · {payload.algorithm}
					</p>

					<TextField
						label="2. Enter the six-digit code"
						value={code}
						onChange={(next) => {
							setError(null);
							setCode(next.replace(/\D/g, "").slice(0, 6));
						}}
						placeholder="123456"
						inputMode="numeric"
						autoFocus
						hint="Nothing changes on your account until this code checks out."
					/>
				</div>
			</div>
		</Dialog>
	);
}

/** Turning 2FA off, or replacing the recovery codes: both need the password. */
function PasswordDialog({
	title,
	description,
	confirmLabel,
	pendingLabel,
	action,
	onClose,
}: {
	title: string;
	description: string;
	confirmLabel: string;
	pendingLabel: string;
	/** Resolves when the work is done; the caller decides what happens next. */
	action: (password: string) => Promise<void>;
	onClose: () => void;
}) {
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	const submit = async () => {
		setError(null);
		setPending(true);
		try {
			await action(password);
		} catch (caught) {
			setError(errorMessage(caught));
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
					<span className="form-note">{error}</span>
					<span style={{ marginLeft: "auto" }} />
					<Button variant="ghost" onClick={onClose} disabled={pending}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={() => void submit()}
						disabled={pending || password.length === 0}
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
						{pending ? pendingLabel : confirmLabel}
					</Button>
				</>
			}
		>
			<TextField
				label="Your password"
				type="password"
				value={password}
				onChange={(next) => {
					setError(null);
					setPassword(next);
				}}
				autoFocus
				hint="Checked against your account password before anything changes."
			/>
		</Dialog>
	);
}

/**
 * Two-factor authentication for the signed-in person: what state the account is
 * in, the enrolment flow, and the two things that undo it. Recovery codes are
 * only ever shown in the moment they are minted.
 */
export function TwoFactorCard({ userId }: { userId?: string }) {
	const status = useTwoFactor(userId);
	const { setup, regenerate, disable } = useTwoFactorMutations(userId);
	const [dialog, setDialog] = useState<
		| null
		| { kind: "setup"; payload: TwoFactorSetup }
		| { kind: "recovery" }
		| { kind: "disable" }
	>(null);
	const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	const startSetup = async () => {
		setError(null);
		try {
			const payload = await setup.mutateAsync();
			setDialog({ kind: "setup", payload });
		} catch (caught) {
			setError(errorMessage(caught));
		}
	};

	const data = status.data;
	const enabled = data?.enabled ?? false;
	const pending = data?.pending ?? false;
	const codesLeft = data?.recovery_codes_left ?? 0;

	return (
		<Card>
			<CardHeader
				title="Two-factor authentication"
				icon={<ShieldCheck size={16} weight="regular" aria-hidden="true" />}
				actions={
					data ? (
						enabled ? (
							<Badge tone="success">On</Badge>
						) : pending ? (
							<Badge tone="warning">Setup pending</Badge>
						) : (
							<Badge tone="outline">Off</Badge>
						)
					) : null
				}
			/>

			{status.isPending ? (
				<div className="card__body">
					<SkeletonStack rows={2} />
				</div>
			) : status.isError ? (
				<div className="card__body">
					<ErrorState
						title="Two-factor status could not be loaded"
						message={errorMessage(status.error)}
						onRetry={() => void status.refetch()}
					/>
				</div>
			) : (
				<>
					<div className="card__body stack--sm">
						<div className="twofa">
							<span
								className={
									enabled ? "twofa__mark twofa__mark--on" : "twofa__mark"
								}
								aria-hidden="true"
							>
								{enabled ? (
									<ShieldCheck size={20} weight="fill" />
								) : (
									<ShieldSlash size={20} weight="regular" />
								)}
							</span>
							<div className="twofa__text">
								<p className="twofa__headline">
									{enabled
										? "A code is required at every sign-in"
										: pending
											? "Setup started but not confirmed"
											: "Your password is the only step right now"}
								</p>
								<p className="twofa__detail">
									{enabled
										? `On since ${formatDateTime(data?.enabled_at ?? "")}. Six-digit codes come from your authenticator app.`
										: pending
											? "Finish the setup to require a code, or start over to get a fresh key."
											: "Add an authenticator app and a wrong password stops being enough on its own."}
								</p>
							</div>
						</div>

						{enabled ? (
							<div className="twofa__codes">
								<Key size={15} weight="regular" aria-hidden="true" />
								<span>
									{codesLeft}{" "}
									{codesLeft === 1 ? "recovery code" : "recovery codes"} left
								</span>
								{codesLeft === 0 ? (
									<Badge tone="error">No way back without the app</Badge>
								) : codesLeft <= 2 ? (
									<Badge tone="warning">Running low</Badge>
								) : null}
							</div>
						) : null}

						{error ? <p className="form-note">{error}</p> : null}

						<div className="twofa__actions">
							{enabled ? (
								<>
									<Button
										variant="secondary"
										onClick={() => setDialog({ kind: "recovery" })}
										icon={<Key size={14} weight="regular" aria-hidden="true" />}
									>
										New recovery codes
									</Button>
									<Button
										variant="ghost"
										onClick={() => setDialog({ kind: "disable" })}
										icon={
											<ShieldSlash
												size={14}
												weight="regular"
												aria-hidden="true"
											/>
										}
									>
										Turn off
									</Button>
								</>
							) : (
								<Button
									variant="primary"
									onClick={() => void startSetup()}
									disabled={setup.isPending}
									icon={
										setup.isPending ? (
											<CircleNotch
												size={14}
												weight="bold"
												className="spinner"
												aria-hidden="true"
											/>
										) : (
											<QrCode size={14} weight="regular" aria-hidden="true" />
										)
									}
								>
									{setup.isPending
										? "Preparing…"
										: pending
											? "Start setup again"
											: "Turn on two-factor"}
								</Button>
							)}
						</div>
					</div>

					<footer className="card__footer">
						Codes are checked on the server and each one works once. An
						administrator can clear two-factor for you if both the app and your
						recovery codes are gone.
					</footer>
				</>
			)}

			{dialog?.kind === "setup" ? (
				<SetupDialog
					userId={userId ?? ""}
					payload={dialog.payload}
					onClose={() => {
						setDialog(null);
						void status.refetch();
					}}
				/>
			) : null}

			{dialog?.kind === "recovery" ? (
				freshCodes ? (
					<Dialog
						title="Fresh recovery codes"
						description="The previous codes stopped working the moment these were made."
						onDismiss={() => {
							setDialog(null);
							setFreshCodes(null);
						}}
						footer={
							<Button
								variant="primary"
								onClick={() => {
									setDialog(null);
									setFreshCodes(null);
								}}
							>
								Done
							</Button>
						}
					>
						<RecoveryCodes codes={freshCodes} />
					</Dialog>
				) : (
					<PasswordDialog
						title="New recovery codes"
						description="Confirm your password and a fresh set replaces the old one."
						confirmLabel="Replace codes"
						pendingLabel="Replacing…"
						action={async (password) => {
							const result = await regenerate.mutateAsync(password);
							setFreshCodes(result.recovery_codes);
							toastSuccess("Recovery codes replaced");
						}}
						onClose={() => setDialog(null)}
					/>
				)
			) : null}

			{dialog?.kind === "disable" ? (
				<PasswordDialog
					title="Turn off two-factor authentication"
					description="From then on your password alone signs you in, and the recovery codes stop working."
					confirmLabel="Turn off"
					pendingLabel="Turning off…"
					action={async (password) => {
						await disable.mutateAsync(password);
						toastSuccess(
							"Two-factor is off",
							"Your account now signs in with a password only.",
						);
						setDialog(null);
					}}
					onClose={() => setDialog(null)}
				/>
			) : null}
		</Card>
	);
}
