import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	ApiError,
	api,
	type LoginResult,
	onUnauthorized,
	type SessionUser,
} from "./api";

const STORAGE_KEY = "optimolms.session.v1";

/**
 * How long the boot probe waits for GET /api/me before treating the answer as
 * lost. A backend that accepts the connection and then says nothing must not
 * leave the shell waiting for ever.
 */
const PROBE_TIMEOUT_MS = 15_000;

/**
 * Delays between retries of a probe that failed for a reason that is not a
 * rejection: the backend restarting, a proxy hiccup, a 5xx. One extra try past
 * the first is enough to ride out the usual dev-server blip.
 */
const PROBE_RETRY_DELAYS_MS = [600, 1_500];

export type Session = {
	user: SessionUser;
	modules: string[];
	/** Permission keys granted to the signed-in role. */
	permissions: string[];
	signedInAt: string;
};

/**
 * Where the boot-time session probe stands.
 *
 * "restoring" is not "signed out": GET /api/me has not answered yet, so a guard
 * that redirects on it bounces a signed-in user to /login on every refresh.
 */
export type SessionStatus = "restoring" | "authenticated" | "signed-out";

type AuthContextValue = {
	session: Session | null;
	/** The probe's verdict. Only "signed-out" may redirect to /login. */
	status: SessionStatus;
	/** The probe gave up without a verdict: the backend was unreachable. */
	restoreFailed: boolean;
	/** Probes GET /api/me again, for the shell's "Try again". */
	retryRestore: () => void;
	/** When the user signed out on purpose, so the shell can skip the redirect toast. */
	signedOutAt: number | null;
	signIn: (result: LoginResult) => void;
	signOut: () => void;
	hasModule: (key: string) => boolean;
	hasPermission: (key: string) => boolean;
	isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isSessionUser(value: unknown): value is SessionUser {
	if (typeof value !== "object" || value === null) return false;
	const user = value as Record<string, unknown>;
	return (
		typeof user.id === "string" &&
		typeof user.email === "string" &&
		typeof user.name === "string" &&
		typeof user.role === "string"
	);
}

/**
 * Reads the persisted session. It is a cache of the last sign-in, not proof of
 * one: the cookie is the credential, and AuthProvider replaces this with whatever
 * GET /api/me reports as soon as the app boots. Anything malformed is treated as
 * signed out.
 */
export function readStoredSession(): Session | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) return null;
		const candidate = parsed as Record<string, unknown>;
		if (!isSessionUser(candidate.user)) return null;
		if (!Array.isArray(candidate.modules)) return null;
		const modules = candidate.modules.filter(
			(key): key is string => typeof key === "string",
		);
		// Sessions stored before permissions shipped simply have none.
		const permissions = Array.isArray(candidate.permissions)
			? candidate.permissions.filter(
					(key): key is string => typeof key === "string",
				)
			: [];
		return {
			user: candidate.user,
			modules,
			permissions,
			signedInAt:
				typeof candidate.signedInAt === "string"
					? candidate.signedInAt
					: new Date().toISOString(),
		};
	} catch {
		return null;
	}
}

/** What a completed sign-in (or GET /api/me) hands the shell. */
function sessionFrom(result: LoginResult): Session {
	return {
		user: result.user,
		modules: result.modules,
		permissions: result.permissions,
		signedInAt: new Date().toISOString(),
	};
}

function persist(session: Session | null): void {
	try {
		if (session) {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
		} else {
			window.localStorage.removeItem(STORAGE_KEY);
		}
	} catch {
		// Storage can be unavailable (private mode, quota). The in-memory session
		// still works for this tab, so nothing fails because of it.
	}
}

/**
 * True when the server answered and refused the cookie (expired, revoked, never
 * there). Every other failure — 5xx, a dropped connection, a timeout — says
 * nothing about the session, and must not be read as a sign-out.
 */
function rejectedSession(error: unknown): boolean {
	return error instanceof ApiError && error.status === 401;
}

/** Rejects with the given error when `promise` takes longer than `ms`. */
function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error("The session probe timed out.")),
			ms,
		);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error: unknown) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

type AuthState = {
	session: Session | null;
	status: SessionStatus;
};

/**
 * The state the app boots in. A cached session is the last known good copy, so
 * the shell may paint it while the probe runs; with nothing cached there is no
 * verdict yet, and the shell waits instead of calling the user signed out.
 */
function initialState(): AuthState {
	const stored = readStoredSession();
	if (stored) return { session: stored, status: "authenticated" };
	return { session: null, status: "restoring" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [{ session, status }, setAuth] = useState<AuthState>(initialState);
	const [signedOutAt, setSignedOutAt] = useState<number | null>(null);
	const [restoreFailed, setRestoreFailed] = useState(false);
	// Bumped by retryRestore: the probe effect re-runs on every change.
	const [probeAttempt, setProbeAttempt] = useState(0);
	// Bumped by every decision that does not come from the probe. A probe that
	// was already in flight then is stale: its answer describes a session the
	// app has since been told is gone (or replaced), so it must not land.
	const decided = useRef(0);

	// Session and status always move together: a session is what "authenticated"
	// means, so they are one state object and cannot disagree.
	const apply = useCallback((next: Session | null) => {
		persist(next);
		setAuth({
			session: next,
			status: next ? "authenticated" : "signed-out",
		});
	}, []);

	const signIn = useCallback(
		(result: LoginResult) => {
			decided.current += 1;
			apply(sessionFrom(result));
		},
		[apply],
	);

	/** Drops the session locally, without asking the server (already gone). */
	const forget = useCallback(() => {
		decided.current += 1;
		apply(null);
	}, [apply]);

	const signOut = useCallback(() => {
		// The cookie is HttpOnly, so only the server can end the session.
		void api.logout().catch(() => undefined);
		decided.current += 1;
		apply(null);
		setSignedOutAt(Date.now());
	}, [apply]);

	/** Runs the boot probe again: the splash offers this when the backend was away. */
	const retryRestore = useCallback(() => {
		setRestoreFailed(false);
		setAuth((current) =>
			current.session ? current : { session: null, status: "restoring" },
		);
		setProbeAttempt((attempt) => attempt + 1);
	}, []);

	// The server owns the session: ask it who we are on every boot. A stored
	// copy survives a reload as a cache, and this replaces it — or clears it when
	// the cookie has expired, been revoked, or was never there.
	//
	// The verdict only changes on an answer. A failure that is not a rejection
	// (the backend restarting, a 5xx, a dropped connection) is retried, and then
	// left alone: the cookie may well be good, so the cached session stays and
	// the user stays signed in.
	useEffect(() => {
		let cancelled = false;
		let retry: ReturnType<typeof setTimeout> | undefined;
		// Anything the rest of the app decides while this probe runs wins: a 401
		// on another request, a sign-out, a sign-in. The probe only gets to speak
		// for a session nobody has contradicted in the meantime.
		const generation = decided.current;
		const current = () => !cancelled && decided.current === generation;

		const settle = (next: Session | null) => {
			if (!current()) return;
			setRestoreFailed(false);
			apply(next);
		};

		function unreachable(attempt: number) {
			if (!current()) return;
			const delay = PROBE_RETRY_DELAYS_MS[attempt];
			if (delay !== undefined) {
				retry = setTimeout(() => run(attempt + 1), delay);
				return;
			}
			// Out of tries. Keep the cache: a probe nobody answered is not a
			// sign-out, so the shell decides from what it already knows.
			setRestoreFailed(true);
			setAuth((state) =>
				state.session
					? { session: state.session, status: "authenticated" }
					: { session: null, status: "restoring" },
			);
		}

		function run(attempt: number) {
			withDeadline(api.me(), PROBE_TIMEOUT_MS).then(
				(result) => settle(sessionFrom(result)),
				(error: unknown) => {
					if (!current()) return;
					if (rejectedSession(error)) {
						settle(null);
						return;
					}
					unreachable(attempt);
				},
			);
		}

		run(0);
		return () => {
			cancelled = true;
			if (retry !== undefined) clearTimeout(retry);
		};
	}, [apply, probeAttempt]);

	// Any other request that comes back 401 means the session died while the tab
	// was open: drop the cached copy and let the shell redirect to /login. Only a
	// 401 ever reaches this (see request() in api.ts), so a probe that failed
	// because the backend was away never signs anybody out here.
	useEffect(() => {
		onUnauthorized(forget);
		return () => onUnauthorized(null);
	}, [forget]);

	const value = useMemo<AuthContextValue>(() => {
		const modules = session?.modules ?? [];
		const permissions = session?.permissions ?? [];
		return {
			session,
			status,
			restoreFailed,
			retryRestore,
			signedOutAt,
			signIn,
			signOut,
			hasModule: (key: string) => modules.includes(key),
			hasPermission: (key: string) => permissions.includes(key),
			isAdmin: session?.user.role === "ADMIN",
		};
	}, [
		session,
		status,
		restoreFailed,
		retryRestore,
		signedOutAt,
		signIn,
		signOut,
	]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const value = useContext(AuthContext);
	if (!value) {
		throw new Error("useAuth must be used inside <AuthProvider>");
	}
	return value;
}

/**
 * The boot verdict on its own, for guards that only need to know whether the
 * session has been decided yet.
 */
export function useAuthSessionStatus(): SessionStatus {
	return useAuth().status;
}

/** Session accessor for screens that only render inside the authenticated shell. */
export function useSession(): Session {
	const { session } = useAuth();
	if (!session) {
		throw new Error("useSession can only be used on authenticated routes");
	}
	return session;
}
