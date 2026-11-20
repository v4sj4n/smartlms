import {
	ArrowLeft,
	CircleNotch,
	Key,
	LockKey,
	WarningCircle,
} from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import { createRoute, Navigate } from "@tanstack/react-router";
import { Field, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { useState } from "react";
import {
	ApiError,
	api,
	errorMessage,
	isLoginChallenge,
	type LoginResult,
} from "../api";
import { useAuth } from "../auth";
import { Button, OptimoLogo } from "../components/ui";
import { firstError } from "../form";
import { formatLockoutTime } from "../format";
import { toastApiError, toastError, toastSuccess } from "../toast";
import { rootRoute } from "./root";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function validateEmail(value: string): string | undefined {
	const trimmed = value.trim();
	if (!trimmed) return "Enter your email address.";
	if (!EMAIL_PATTERN.test(trimmed)) {
		return "Enter an email address like name@school.edu.";
	}
	return undefined;
}

function validatePassword(value: string): string | undefined {
	if (!value) return "Enter your password.";
	if (value.length < MIN_PASSWORD_LENGTH) {
		return `Passwords are at least ${MIN_PASSWORD_LENGTH} characters.`;
	}
	return undefined;
}

type FormAlert =
	| { kind: "lockout"; lockedUntil: string }
	| { kind: "error"; message: string }
	| null;

/**
 * Seeded accounts, shown to whoever runs a dev server. `import.meta.env.DEV` is
 * false in a production build, so `vite build` drops the hint (and the list)
 * from the bundle entirely and the sign-in screen carries no credentials.
 */
const SHOW_DEMO_ACCOUNTS = import.meta.env.DEV;

const DEMO_ACCOUNTS = [
	{ email: "admin@optimolms.dev", password: "admin123", role: "Admin" },
	{
		email: "lecturer@optimolms.dev",
		password: "lecturer123",
		role: "Lecturer",
	},
	{ email: "student@optimolms.dev", password: "student123", role: "Student" },
];

/**
 * The ticket handed out by a correct password on an account with two-factor on.
 * It is worthless without a code, and it stops working after a few minutes.
 */
type PendingChallenge = {
	token: string;
	email: string;
	name: string;
};

/**
 * Second step of a two-factor sign-in. Six digits are auto-submitted as soon as
 * the last one lands, the way a passcode screen behaves; a recovery code is
 * entered the same way but in its own field.
 */
function CodeStep({
	challenge,
	onSignedIn,
	onStartOver,
}: {
	challenge: PendingChallenge;
	onSignedIn: (result: LoginResult) => void;
	onStartOver: (message?: string) => void;
}) {
	const [code, setCode] = useState("");
	const [useRecovery, setUseRecovery] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [verifying, setVerifying] = useState(false);

	const verify = async (value: string, recovery: boolean) => {
		const trimmed = value.trim();
		if (!trimmed || verifying) return;
		setVerifying(true);
		setError(null);
		try {
			const result = await api.loginTwoFactor(
				recovery
					? { challenge: challenge.token, recovery_code: trimmed }
					: { challenge: challenge.token, code: trimmed },
			);
			onSignedIn(result);
		} catch (caught) {
			if (caught instanceof ApiError) {
				const body = caught.asLoginError();
				if (caught.status === 423) {
					onStartOver(body.locked_until);
					return;
				}
				if (caught.status === 401) {
					// A dead ticket cannot be rescued by trying again: go back to the
					// password step rather than leaving a form that can never work.
					if ((caught.apiMessage() ?? "").includes("sign-in request")) {
						onStartOver();
						return;
					}
					const left = body.attempts_left;
					setError(
						typeof left === "number"
							? `That ${recovery ? "recovery code" : "code"} is not valid. ${left} ${
									left === 1 ? "try" : "tries"
								} left.`
							: `That ${recovery ? "recovery code" : "code"} is not valid.`,
					);
					return;
				}
			}
			setError(errorMessage(caught));
		} finally {
			setVerifying(false);
		}
	};

	return (
		<form
			className="login__form"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				void verify(code, useRecovery);
			}}
		>
			<div className="login__fields">
				{error ? (
					<div className="alert" role="alert">
						<span className="alert__icon">
							<WarningCircle size={16} weight="regular" aria-hidden="true" />
						</span>
						<div className="alert__body">
							<p className="alert__title">Code rejected</p>
							<p className="alert__text">{error}</p>
						</div>
					</div>
				) : null}

				<Field className="field">
					<FieldLabel className="field__label">
						{useRecovery ? "Recovery code" : "Authentication code"}
					</FieldLabel>
					<Input
						className={useRecovery ? "input" : "input input--code"}
						type="text"
						name={useRecovery ? "recovery_code" : "code"}
						inputMode={useRecovery ? "text" : "numeric"}
						autoComplete="one-time-code"
						autoFocus
						spellCheck={false}
						placeholder={useRecovery ? "ABCDE-FGHJK" : "123456"}
						value={code}
						onValueChange={(next) => {
							setError(null);
							if (useRecovery) {
								setCode(next.toUpperCase());
								return;
							}
							const digits = next.replace(/\D/g, "").slice(0, 6);
							setCode(digits);
							if (digits.length === 6) void verify(digits, false);
						}}
					/>
					<p className="field__description">
						{useRecovery
							? "One of the codes you saved when you turned two-factor on. Each one works once."
							: `Open your authenticator app and enter the six-digit code for ${challenge.email}.`}
					</p>
				</Field>
			</div>

			<div className="login__actions">
				<Button
					type="submit"
					variant="primary"
					block
					className="login__submit"
					disabled={verifying || code.trim().length === 0}
					icon={
						verifying ? (
							<CircleNotch
								size={15}
								weight="bold"
								className="spinner"
								aria-hidden="true"
							/>
						) : (
							<Key size={15} weight="regular" aria-hidden="true" />
						)
					}
				>
					{verifying ? "Checking…" : "Verify and sign in"}
				</Button>
			</div>

			<div className="login__secondary">
				<button
					type="button"
					className="link-btn"
					onClick={() => {
						setUseRecovery((current) => !current);
						setCode("");
						setError(null);
					}}
				>
					{useRecovery
						? "Use an authenticator code instead"
						: "Use a recovery code instead"}
				</button>
				<button
					type="button"
					className="link-btn"
					onClick={() => onStartOver()}
				>
					<ArrowLeft size={12} weight="bold" aria-hidden="true" />
					Use a different account
				</button>
			</div>
		</form>
	);
}

function LoginPage() {
	const { session, signIn } = useAuth();
	const [alert, setAlert] = useState<FormAlert>(null);
	// A rejected credential belongs to the password field, but it is not a
	// client-side rule: it is cleared the moment the user edits either field.
	const [credentialError, setCredentialError] = useState<string | null>(null);
	// Set once the password is accepted on a two-factor account: the code step
	// replaces the form until it is completed or abandoned.
	const [challenge, setChallenge] = useState<PendingChallenge | null>(null);

	const completeSignIn = (result: LoginResult) => {
		signIn(result);
		toastSuccess("Signed in", `${result.user.name} · ${result.user.role}`);
	};

	const form = useForm({
		defaultValues: { email: "", password: "" },
		onSubmit: async ({ value }) => {
			setAlert(null);
			setCredentialError(null);
			try {
				const result = await api.login({
					email: value.email.trim(),
					password: value.password,
				});
				if (isLoginChallenge(result)) {
					// The password was right, so it is not a credential error: the same
					// correct password comes back after the code is verified.
					setChallenge({
						token: result.challenge,
						email: result.user.email,
						name: result.user.name,
					});
					return;
				}
				completeSignIn(result);
			} catch (error) {
				if (error instanceof ApiError) {
					const body = error.asLoginError();

					if (error.status === 401) {
						const attempts = body.attempts_left;
						const message =
							typeof attempts === "number"
								? `Incorrect email or password. ${attempts} ${
										attempts === 1 ? "attempt" : "attempts"
									} left.`
								: "Incorrect email or password.";
						setCredentialError(message);
						form.setFieldValue("password", "");
						toastError(
							"Invalid email or password",
							typeof attempts === "number"
								? `${attempts} ${attempts === 1 ? "attempt" : "attempts"} left`
								: undefined,
						);
						return;
					}

					if (error.status === 423) {
						const lockedUntil = body.locked_until ?? "";
						setAlert({ kind: "lockout", lockedUntil });
						toastError(
							lockedUntil
								? `Account locked until ${formatLockoutTime(lockedUntil)}`
								: "Account locked",
							"Too many failed attempts. Try again later.",
						);
						return;
					}
				}

				setAlert({ kind: "error", message: errorMessage(error) });
				toastApiError(error, "Sign in failed");
			}
		},
	});

	if (session) return <Navigate to="/" replace />;

	const lockoutMessage =
		alert?.kind === "lockout"
			? alert.lockedUntil
				? `Too many failed attempts. Try again at ${formatLockoutTime(
						alert.lockedUntil,
					)}.`
				: "Too many failed attempts. This account is locked for now."
			: null;

	return (
		<div className="login">
			<div className="login__panel">
				<div className="login__top">
					<div className="login__brand">
						<OptimoLogo className="sidebar__logo" />
						<span className="sidebar__wordmark">
							<span className="sidebar__name">OptimoLMS</span>
							<span className="sidebar__caption">Learning platform</span>
						</span>
					</div>
				</div>

				<section className="card">
					<div className="login__intro">
						<h1 className="login__title">
							{challenge ? "Enter your code" : "Sign in"}
						</h1>
						<p className="login__description">
							{challenge
								? `Two-factor is on for ${challenge.name}'s account. One more step and you are in.`
								: "Use your OptimoLMS account to reach the modules your role allows."}
						</p>
					</div>

					{challenge ? (
						<CodeStep
							challenge={challenge}
							onSignedIn={completeSignIn}
							onStartOver={(lockedUntil) => {
								setChallenge(null);
								form.setFieldValue("password", "");
								setAlert(
									lockedUntil
										? { kind: "lockout", lockedUntil }
										: {
												kind: "error",
												message:
													"That sign-in attempt expired. Enter your password again to get a fresh code prompt.",
											},
								);
							}}
						/>
					) : (
						<form
							className="login__form"
							noValidate
							onSubmit={(event) => {
								event.preventDefault();
								void form.handleSubmit();
							}}
						>
							<div className="login__fields">
								{alert ? (
									<div
										className={
											alert.kind === "lockout"
												? "alert alert--warning"
												: "alert"
										}
										role="alert"
									>
										<span className="alert__icon">
											{alert.kind === "lockout" ? (
												<LockKey
													size={16}
													weight="regular"
													aria-hidden="true"
												/>
											) : (
												<WarningCircle
													size={16}
													weight="regular"
													aria-hidden="true"
												/>
											)}
										</span>
										<div className="alert__body">
											<p className="alert__title">
												{alert.kind === "lockout"
													? "Account locked"
													: "Sign in failed"}
											</p>
											<p className="alert__text">
												{lockoutMessage ??
													(alert.kind === "error" ? alert.message : null)}
											</p>
										</div>
									</div>
								) : null}

								<form.Field
									name="email"
									validators={{
										onChange: ({ value }) => validateEmail(value),
									}}
								>
									{(field) => {
										const error = field.state.meta.isDirty
											? firstError(field.state.meta.errors)
											: undefined;
										const showError = Boolean(error);
										return (
											<Field
												className="field"
												name={field.name}
												invalid={showError}
											>
												<FieldLabel className="field__label">Email</FieldLabel>
												<Input
													className="input"
													type="email"
													name={field.name}
													autoComplete="username"
													spellCheck={false}
													autoCapitalize="none"
													autoFocus
													placeholder="you@school.edu"
													value={field.state.value}
													onValueChange={(next) => {
														setCredentialError(null);
														field.handleChange(next);
													}}
													onBlur={() => field.handleBlur()}
												/>
												{showError ? (
													<FieldError match className="field__error">
														{error}
													</FieldError>
												) : null}
											</Field>
										);
									}}
								</form.Field>

								<form.Field
									name="password"
									validators={{
										onChange: ({ value }) => validatePassword(value),
									}}
								>
									{(field) => {
										const error =
											credentialError ??
											(field.state.meta.isDirty
												? firstError(field.state.meta.errors)
												: undefined);
										const showError = Boolean(error);
										return (
											<Field
												className="field"
												name={field.name}
												invalid={showError}
											>
												<FieldLabel className="field__label">
													Password
												</FieldLabel>
												<Input
													className="input"
													type="password"
													name={field.name}
													autoComplete="current-password"
													placeholder="••••••••"
													value={field.state.value}
													onValueChange={(next) => {
														if (credentialError !== null)
															setCredentialError(null);
														field.handleChange(next);
													}}
													onBlur={() => field.handleBlur()}
												/>
												{showError ? (
													<FieldError match className="field__error">
														{error}
													</FieldError>
												) : null}
											</Field>
										);
									}}
								</form.Field>
							</div>

							<div className="login__actions">
								<form.Subscribe
									selector={(state) =>
										[
											state.canSubmit,
											state.isSubmitting,
											state.values.email,
											state.values.password,
										] as const
									}
								>
									{([canSubmit, isSubmitting, email, password]) => {
										const valuesValid =
											validateEmail(email) === undefined &&
											validatePassword(password) === undefined;
										return (
											<Button
												type="submit"
												variant="primary"
												block
												className="login__submit"
												disabled={!canSubmit || !valuesValid || isSubmitting}
												icon={
													isSubmitting ? (
														<CircleNotch
															size={15}
															weight="bold"
															className="spinner"
															aria-hidden="true"
														/>
													) : (
														<LockKey
															size={15}
															weight="regular"
															aria-hidden="true"
														/>
													)
												}
											>
												{isSubmitting ? "Signing in…" : "Sign in"}
											</Button>
										);
									}}
								</form.Subscribe>
							</div>
						</form>
					)}

					{SHOW_DEMO_ACCOUNTS && !challenge ? (
						<div className="login__demo">
							<span>Demo accounts</span>
							<div className="login__demo-list">
								{DEMO_ACCOUNTS.map((account) => (
									<span className="login__demo-row" key={account.email}>
										<code>{account.email}</code>
										<code>{account.password}</code>
									</span>
								))}
							</div>
						</div>
					) : null}
				</section>
			</div>
		</div>
	);
}

export const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	component: LoginPage,
});
