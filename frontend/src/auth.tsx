import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import type { LoginResult, SessionUser } from "./api";

const STORAGE_KEY = "smartlms.session.v1";

export type Session = {
	user: SessionUser;
	modules: string[];
	/** Permission keys granted to the signed-in role. */
	permissions: string[];
	signedInAt: string;
};

type AuthContextValue = {
	session: Session | null;
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

/** Reads the persisted session. Anything malformed is treated as signed out. */
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

export function AuthProvider({ children }: { children: ReactNode }) {
	const [session, setSession] = useState<Session | null>(() =>
		readStoredSession(),
	);
	const [signedOutAt, setSignedOutAt] = useState<number | null>(null);

	const signIn = useCallback((result: LoginResult) => {
		const next: Session = {
			user: result.user,
			modules: result.modules,
			permissions: result.permissions,
			signedInAt: new Date().toISOString(),
		};
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {
			// Storage can be unavailable (private mode, quota). The in-memory
			// session still works for this tab, so login does not fail.
		}
		setSession(next);
	}, []);

	const signOut = useCallback(() => {
		try {
			window.localStorage.removeItem(STORAGE_KEY);
		} catch {
			// Ignore: clearing in-memory state below is enough.
		}
		setSession(null);
		setSignedOutAt(Date.now());
	}, []);

	const value = useMemo<AuthContextValue>(() => {
		const modules = session?.modules ?? [];
		const permissions = session?.permissions ?? [];
		return {
			session,
			signedOutAt,
			signIn,
			signOut,
			hasModule: (key: string) => modules.includes(key),
			hasPermission: (key: string) => permissions.includes(key),
			isAdmin: session?.user.role === "ADMIN",
		};
	}, [session, signedOutAt, signIn, signOut]);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const value = useContext(AuthContext);
	if (!value) {
		throw new Error("useAuth must be used inside <AuthProvider>");
	}
	return value;
}

/** Session accessor for screens that only render inside the authenticated shell. */
export function useSession(): Session {
	const { session } = useAuth();
	if (!session) {
		throw new Error("useSession can only be used on authenticated routes");
	}
	return session;
}
