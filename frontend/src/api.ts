export type Health = { status: string; service: string; db: string };

/** A named, module-owned permission such as `campuses.manage`. */
export type Permission = {
	key: string;
	label: string;
	description?: string;
};

export type ModuleAccess = {
	key: string;
	name: string;
	permissions: Permission[];
};

export type Role = {
	id: string;
	name: string;
	modules: ModuleAccess[];
	/** Permission keys granted to this role. */
	granted: string[];
};

export type MetaUser = { email: string; name: string; role: string };

export type Meta = {
	modules: ModuleAccess[];
	roles: Role[];
	users: MetaUser[];
};

export type ClassRoom = {
	id: string;
	name: string;
	capacity: number;
	tags: string[];
};

export type Story = {
	id: string;
	floor: number;
	name: string;
	classes: ClassRoom[];
};

export type Campus = {
	id: string;
	name: string;
	address?: string;
	stories: Story[];
};

export type SessionUser = {
	id: string;
	email: string;
	name: string;
	role: string;
};

/** Envelope returned by the paginated list endpoints. */
export type Paginated<T> = {
	items: T[];
	total: number;
	page: number;
	page_size: number;
};

/** Row shape of GET /api/users (it exposes lock state, unlike meta.users). */
export type AdminUser = {
	id: string;
	email: string;
	name: string;
	role: string;
	failed_login_attempts: number;
	locked_until?: string;
	/** True once the person has confirmed an authenticator app. */
	two_factor_enabled: boolean;
};

export type Notification = {
	id: string;
	title: string;
	message: string;
	read: boolean;
	created_at: string;
};

export type UserListParams = {
	page: number;
	page_size: number;
	role?: string;
	search?: string;
};

/** An academic year. At most one of them is current. */
export type SchoolYear = {
	id: string;
	/** Canonical form: two calendar years, 2026/2027. */
	name: string;
	starts_on?: string;
	ends_on?: string;
	is_active: boolean;
	/** How many subjects are scheduled into this year. */
	subjects: number;
};

export type SchoolYearList = { items: SchoolYear[]; active?: string };

export type SchoolYearInput = {
	name: string;
	starts_on?: string;
	ends_on?: string;
	is_active?: boolean;
};

/* --- academic structure ---------------------------------------------------
 * faculty (Fakulteti) -> department (Departamenti) -> programme (Dega).
 * A programme is what a student is admitted to and what owns its courses. */

export type ProgrammeLevel = "BACHELOR" | "MASTER" | "DOCTORATE";

/** Where an admission stands. A student has at most one ACTIVE admission. */
export type AdmissionStatus =
	| "ACTIVE"
	| "GRADUATED"
	| "SUSPENDED"
	| "WITHDRAWN";

export type ProgrammeRow = {
	id: string;
	department_id: string;
	name: string;
	code?: string;
	level: ProgrammeLevel;
	duration_years: number;
	total_ects?: number;
	/** Courses in the programme's curriculum. */
	courses: number;
	/** Students with an active admission. */
	students: number;
};

export type Department = {
	id: string;
	faculty_id: string;
	name: string;
	code?: string;
	students: number;
	programmes: ProgrammeRow[];
};

export type Faculty = {
	id: string;
	name: string;
	code?: string;
	students: number;
	departments: Department[];
};

export type AcademicTree = {
	faculties: Faculty[];
	/** Courses no programme owns yet. */
	unassigned_courses: number;
	/** Students with no active admission. */
	unplaced_students: number;
};

export type Programme = ProgrammeRow & {
	description?: string;
	faculty_id: string;
	faculty_name: string;
	department_name: string;
};

export type ProgrammeCourse = {
	id: string;
	name: string;
	code?: string;
	lecturer_name?: string;
	ects?: number;
	semester: "FIRST" | "SECOND";
	school_year?: string;
	year_of_study: number;
};

export type ProgrammeStudent = {
	/** Id of the admission, not of the person. */
	enrollment_id: string;
	student_id: string;
	name: string;
	email: string;
	school_year?: string;
	year_of_study: number;
	status: AdmissionStatus;
	enrolled_at: string;
};

export type ProgrammeDetail = {
	programme: Programme;
	courses: ProgrammeCourse[];
	students: ProgrammeStudent[];
};

export type FacultyInput = { name: string; code?: string };

export type DepartmentInput = {
	faculty_id: string;
	name: string;
	code?: string;
};

export type ProgrammeInput = {
	department_id: string;
	name: string;
	code?: string;
	level?: ProgrammeLevel;
	duration_years?: number;
	total_ects?: number;
	description?: string;
};

export type AdmissionInput = {
	student_id: string;
	school_year?: string;
	year_of_study?: number;
	status?: AdmissionStatus;
};

export type AdmissionUpdate = {
	school_year?: string;
	year_of_study?: number;
	status?: AdmissionStatus;
};

export type CourseAssignmentInput = {
	subject_id: string;
	year_of_study?: number;
};

/* --- course weeks ---------------------------------------------------------
 * A school year runs in two seasons: fall and summer. A subject is taught week
 * by week inside one of them. */

export type WeekSeason = "FALL" | "SUMMER";

export type WeekItemKind = "lecture" | "assignment" | "quiz" | "flashcard";

/** One piece of content inside a week. */
export type WeekItem = {
	id: string;
	kind: WeekItemKind;
	title: string;
	scheduled_at?: string;
	due_at?: string;
};

export type CourseWeek = {
	id: string;
	subject_id: string;
	school_year?: string;
	season: WeekSeason;
	week_number: number;
	title?: string;
	description?: string;
	starts_on?: string;
	ends_on?: string;
	items: WeekItem[];
};

export type SubjectWeeks = {
	subject_id: string;
	subject_name: string;
	school_year?: string;
	/** The season the subject itself runs in. */
	season: WeekSeason;
	weeks: CourseWeek[];
	/** Content of the subject that is not filed into a week yet. */
	unscheduled: WeekItem[];
};

export type WeekInput = {
	school_year?: string;
	season?: WeekSeason;
	/** Omitted means "the next free number in the season". */
	week_number?: number;
	title?: string;
	description?: string;
	starts_on?: string;
	ends_on?: string;
};

export type SubjectCounts = {
	lectures: number;
	assignments: number;
	quizzes: number;
	flashcards: number;
};

export type Subject = {
	id: string;
	name: string;
	code?: string;
	description?: string;
	lecturer_id?: string;
	lecturer_name?: string;
	ects?: number;
	semester: "FIRST" | "SECOND";
	school_year?: string;
	/** The programme that offers this course, empty until it is assigned. */
	programme_id?: string;
	programme_name?: string;
	year_of_study?: number;
	counts: SubjectCounts;
};

/** Lectures and seminars share a shape on the API. */
export type SessionItem = {
	id: string;
	title: string;
	description?: string;
	class_id?: string;
	class_name?: string;
	scheduled_at?: string;
	week_id?: string;
};

export type Quiz = {
	id: string;
	title: string;
	description?: string;
	time_limit_minutes: number;
	question_count: number;
	week_id?: string;
};

export type Flashcard = {
	id: string;
	front: string;
	back: string;
	week_id?: string;
};

export type SubjectDetail = Subject & {
	lectures: SessionItem[];
	assignments: Assignment[];
	quizzes: Quiz[];
	flashcards: Flashcard[];
};

export type SubjectInput = {
	name: string;
	code?: string;
	description?: string;
	lecturer_id?: string;
	ects?: number;
	semester?: "FIRST" | "SECOND";
	school_year?: string;
	programme_id?: string;
	year_of_study?: number;
};

export type SessionInput = {
	title: string;
	description?: string;
	class_id?: string;
	scheduled_at?: string;
	week_id?: string;
};

export type QuizInput = {
	title: string;
	description?: string;
	time_limit_minutes?: number;
	week_id?: string;
};

export type FlashcardInput = { front: string; back: string; week_id?: string };

export type CampusInput = { name: string; address?: string };

/** Path segment for the lecture endpoints (assignments have their own API). */
export type SessionKind = "lectures";
export type StoryInput = { floor: number; name?: string };
export type ClassRoomInput = {
	name: string;
	capacity?: number;
	tags?: string[];
};

export type LoginResult = {
	user: SessionUser;
	modules: string[];
	permissions: string[];
};

/**
 * Answer to a correct password on an account with two-factor on: the password
 * bought a ticket for the code step, and nothing signed-in exists yet.
 */
export type LoginChallenge = {
	two_factor_required: true;
	challenge: string;
	expires_at: string;
	user: Pick<SessionUser, "id" | "email" | "name">;
};

/** POST /api/auth/login answers with either a session or a 2FA ticket. */
export type LoginOutcome = LoginResult | LoginChallenge;

export function isLoginChallenge(
	outcome: LoginOutcome,
): outcome is LoginChallenge {
	return (
		"two_factor_required" in outcome && outcome.two_factor_required === true
	);
}

/** Response of PUT /api/roles/{roleID}/permissions. */
export type RolePermissionsResult = { role: string; granted: string[] };

/** Error body returned by POST /api/auth/login. */
export type LoginErrorBody = {
	error?: string;
	attempts_left?: number;
	locked_until?: string;
};

/** Thrown for every non-2xx response so callers can branch on `status`. */
export class ApiError extends Error {
	readonly status: number;
	readonly body: unknown;

	constructor(status: number, body: unknown) {
		super(
			typeof body === "object" && body !== null && "error" in body
				? String((body as { error: unknown }).error)
				: `Request failed with HTTP ${status}`,
		);
		this.name = "ApiError";
		this.status = status;
		this.body = body;
	}

	/** The API's `{"error": ...}` message, when the body carries one. */
	apiMessage(): string | undefined {
		if (
			typeof this.body === "object" &&
			this.body !== null &&
			"error" in this.body
		) {
			const message = (this.body as { error: unknown }).error;
			return typeof message === "string" ? message : undefined;
		}
		return undefined;
	}

	/** The parsed JSON body when it is shaped like a login error. */
	asLoginError(): LoginErrorBody {
		return (
			typeof this.body === "object" && this.body !== null ? this.body : {}
		) as LoginErrorBody;
	}
}

const NETWORK_ERROR = "Cannot reach the backend. Is it running on :8081?";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	let response: Response;
	try {
		response = await fetch(path, init);
	} catch {
		throw new ApiError(0, { error: NETWORK_ERROR });
	}

	const text = await response.text();
	let body: unknown = null;
	if (text) {
		try {
			body = JSON.parse(text) as unknown;
		} catch {
			body = text;
		}
	}

	if (!response.ok) {
		throw new ApiError(response.status, body);
	}

	return body as T;
}

/** Drops empty parameters so the API keeps its own defaults. */
function queryString(
	params: Record<string, string | number | undefined>,
): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === "") continue;
		search.set(key, String(value));
	}
	const encoded = search.toString();
	return encoded ? `?${encoded}` : "";
}

function jsonRequest(method: string, body: unknown): RequestInit {
	return {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	};
}

export const api = {
	health: () => request<Health>("/api/health"),

	meta: () => request<Meta>("/api/meta"),

	campuses: () => request<Campus[]>("/api/campuses"),

	schoolYears: () => request<SchoolYearList>("/api/school-years"),

	createSchoolYear: (input: SchoolYearInput) =>
		request<SchoolYear>("/api/school-years", jsonRequest("POST", input)),

	updateSchoolYear: (id: string, input: Partial<SchoolYearInput>) =>
		request<void>(`/api/school-years/${id}`, jsonRequest("PATCH", input)),

	/** Promotes one year to current and demotes the other, in one step. */
	activateSchoolYear: (id: string) =>
		request<void>(`/api/school-years/${id}/activate`, { method: "POST" }),

	deleteSchoolYear: (id: string) =>
		request<void>(`/api/school-years/${id}`, { method: "DELETE" }),

	/* --- academic structure ------------------------------------------------ */

	academic: () => request<AcademicTree>("/api/academic"),

	programme: (id: string) => request<ProgrammeDetail>(`/api/programmes/${id}`),

	createFaculty: (input: FacultyInput) =>
		request<Faculty>("/api/faculties", jsonRequest("POST", input)),

	updateFaculty: (id: string, input: Partial<FacultyInput>) =>
		request<void>(`/api/faculties/${id}`, jsonRequest("PATCH", input)),

	deleteFaculty: (id: string) =>
		request<void>(`/api/faculties/${id}`, { method: "DELETE" }),

	createDepartment: (input: DepartmentInput) =>
		request<Department>("/api/departments", jsonRequest("POST", input)),

	updateDepartment: (id: string, input: Partial<DepartmentInput>) =>
		request<void>(`/api/departments/${id}`, jsonRequest("PATCH", input)),

	deleteDepartment: (id: string) =>
		request<void>(`/api/departments/${id}`, { method: "DELETE" }),

	createProgramme: (input: ProgrammeInput) =>
		request<ProgrammeRow>("/api/programmes", jsonRequest("POST", input)),

	updateProgramme: (id: string, input: Partial<ProgrammeInput>) =>
		request<void>(`/api/programmes/${id}`, jsonRequest("PATCH", input)),

	deleteProgramme: (id: string) =>
		request<void>(`/api/programmes/${id}`, { method: "DELETE" }),

	/** Admits a student to a programme. Only student accounts qualify. */
	admitStudent: (programmeId: string, input: AdmissionInput) =>
		request<ProgrammeStudent>(
			`/api/programmes/${programmeId}/students`,
			jsonRequest("POST", input),
		),

	updateAdmission: (enrollmentId: string, input: AdmissionUpdate) =>
		request<void>(
			`/api/programme-enrollments/${enrollmentId}`,
			jsonRequest("PATCH", input),
		),

	removeAdmission: (enrollmentId: string) =>
		request<void>(`/api/programme-enrollments/${enrollmentId}`, {
			method: "DELETE",
		}),

	/** Files a course under the programme that offers it. */
	assignCourse: (programmeId: string, input: CourseAssignmentInput) =>
		request<void>(
			`/api/programmes/${programmeId}/courses`,
			jsonRequest("POST", input),
		),

	unassignCourse: (programmeId: string, subjectId: string) =>
		request<void>(`/api/programmes/${programmeId}/courses/${subjectId}`, {
			method: "DELETE",
		}),

	login: (credentials: { email: string; password: string }) =>
		request<LoginOutcome>("/api/auth/login", jsonRequest("POST", credentials)),

	/** Second sign-in step: a code from the app, or a recovery code. */
	loginTwoFactor: (input: {
		challenge: string;
		code?: string;
		recovery_code?: string;
	}) => request<LoginResult>("/api/auth/login/2fa", jsonRequest("POST", input)),

	subjects: (params: {
		page: number;
		page_size: number;
		school_year?: string;
	}) => request<Paginated<Subject>>(`/api/subjects${queryString(params)}`),

	users: (params: UserListParams) =>
		request<Paginated<AdminUser>>(`/api/users${queryString(params)}`),

	notifications: (userId: string) =>
		request<Notification[]>(
			`/api/notifications${queryString({ user_id: userId })}`,
		),

	markNotificationRead: (id: string) =>
		request<{ status: string }>(`/api/notifications/${id}/read`, {
			method: "POST",
		}),

	markAllNotificationsRead: (userId: string) =>
		request<void>(
			"/api/notifications/read-all",
			jsonRequest("POST", { user_id: userId }),
		),

	subject: (id: string) => request<SubjectDetail>(`/api/subjects/${id}`),

	createSubject: (input: SubjectInput) =>
		request<{ id: string }>("/api/subjects", jsonRequest("POST", input)),

	updateSubject: (id: string, input: Partial<SubjectInput>) =>
		request<void>(`/api/subjects/${id}`, jsonRequest("PATCH", input)),

	deleteSubject: (id: string) =>
		request<void>(`/api/subjects/${id}`, { method: "DELETE" }),

	createSession: (kind: SessionKind, subjectId: string, input: SessionInput) =>
		request<SessionItem>(
			`/api/subjects/${subjectId}/${kind}`,
			jsonRequest("POST", input),
		),

	updateSession: (
		kind: SessionKind,
		id: string,
		input: Partial<SessionInput>,
	) => request<void>(`/api/${kind}/${id}`, jsonRequest("PATCH", input)),

	deleteSession: (kind: SessionKind, id: string) =>
		request<void>(`/api/${kind}/${id}`, { method: "DELETE" }),

	createQuiz: (subjectId: string, input: QuizInput) =>
		request<Quiz>(
			`/api/subjects/${subjectId}/quizzes`,
			jsonRequest("POST", input),
		),

	updateQuiz: (id: string, input: Partial<QuizInput>) =>
		request<void>(`/api/quizzes/${id}`, jsonRequest("PATCH", input)),

	deleteQuiz: (id: string) =>
		request<void>(`/api/quizzes/${id}`, { method: "DELETE" }),

	createFlashcard: (subjectId: string, input: FlashcardInput) =>
		request<Flashcard>(
			`/api/subjects/${subjectId}/flashcards`,
			jsonRequest("POST", input),
		),

	updateFlashcard: (id: string, input: Partial<FlashcardInput>) =>
		request<void>(`/api/flashcards/${id}`, jsonRequest("PATCH", input)),

	deleteFlashcard: (id: string) =>
		request<void>(`/api/flashcards/${id}`, { method: "DELETE" }),

	/** The week-by-week view of a subject, plus content not in a week yet. */
	weeks: (subjectId: string) =>
		request<SubjectWeeks>(`/api/subjects/${subjectId}/weeks`),

	createWeek: (subjectId: string, input: WeekInput) =>
		request<CourseWeek>(
			`/api/subjects/${subjectId}/weeks`,
			jsonRequest("POST", input),
		),

	updateWeek: (id: string, input: Partial<WeekInput>) =>
		request<void>(`/api/weeks/${id}`, jsonRequest("PATCH", input)),

	deleteWeek: (id: string) =>
		request<void>(`/api/weeks/${id}`, { method: "DELETE" }),

	createCampus: (input: CampusInput) =>
		request<Campus>("/api/campuses", jsonRequest("POST", input)),

	updateCampus: (id: string, input: Partial<CampusInput>) =>
		request<void>(`/api/campuses/${id}`, jsonRequest("PATCH", input)),

	deleteCampus: (id: string) =>
		request<void>(`/api/campuses/${id}`, { method: "DELETE" }),

	createStory: (campusId: string, input: StoryInput) =>
		request<Story>(
			`/api/campuses/${campusId}/stories`,
			jsonRequest("POST", input),
		),

	updateStory: (id: string, input: Partial<StoryInput>) =>
		request<void>(`/api/stories/${id}`, jsonRequest("PATCH", input)),

	deleteStory: (id: string) =>
		request<void>(`/api/stories/${id}`, { method: "DELETE" }),

	createClass: (storyId: string, input: ClassRoomInput) =>
		request<ClassRoom>(
			`/api/stories/${storyId}/classes`,
			jsonRequest("POST", input),
		),

	updateClass: (id: string, input: Partial<ClassRoomInput>) =>
		request<void>(`/api/classes/${id}`, jsonRequest("PATCH", input)),

	deleteClass: (id: string) =>
		request<void>(`/api/classes/${id}`, { method: "DELETE" }),

	/** Replaces a role's grants with exactly `permissionKeys` (and, if given, its modules). */
	updateRolePermissions: (
		roleId: string,
		permissionKeys: string[],
		moduleKeys?: string[],
	) =>
		request<RolePermissionsResult>(`/api/roles/${roleId}/permissions`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				permission_keys: permissionKeys,
				module_keys: moduleKeys,
			}),
		}),

	/** Creates a role, optionally importing another role's modules and grants. */
	createRole: (name: string, copyFrom?: string) =>
		request<{ id: string; name: string }>(
			"/api/roles",
			jsonRequest("POST", { name, copy_from: copyFrom || undefined }),
		),

	/** Per-user AI assistant preferences (General + Personalization). */
	/** Per-user appearance (theme + reading font). */
	appearance: (userId: string) =>
		request<UserAppearance>(
			`/api/me/appearance${queryString({ user_id: userId })}`,
		),

	updateAppearance: (input: UserAppearance) =>
		request<UserAppearance>("/api/me/appearance", jsonRequest("PUT", input)),

	/** MCP apps: the whole catalog, split into this person's connections and the rest. */
	mcpApps: (userId: string) =>
		request<McpAppList>(`/api/me/mcp-apps${queryString({ user_id: userId })}`),

	connectMcpApp: (input: { user_id: string; app_key: string }) =>
		request<McpAppList>("/api/me/mcp-apps", jsonRequest("POST", input)),

	disconnectMcpApp: (appKey: string, userId: string) =>
		request<McpAppList>(
			`/api/me/mcp-apps/${encodeURIComponent(appKey)}${queryString({ user_id: userId })}`,
			{ method: "DELETE" },
		),

	/** The built-in server's tools, gated per permission for this person. */
	mcpTools: (userId: string) =>
		request<McpServerTools>(
			`/api/mcp/tools${queryString({ user_id: userId })}`,
		),

	/** Providers and models the chat can use right now, for the model picker. */
	aiChatModels: (userId: string) =>
		request<AiChatModels>(
			`/api/ai/chat-models${queryString({ user_id: userId })}`,
		),

	aiSessions: (userId: string, page = 1, limit = 15) =>
		request<AiSessionPage>(
			`/api/ai/sessions${queryString({ user_id: userId, page, limit })}`,
		),

	createAiSession: (userId: string) =>
		request<AiSession>(
			"/api/ai/sessions",
			jsonRequest("POST", { user_id: userId }),
		),

	aiSession: (id: string, userId: string) =>
		request<AiSessionDetail>(
			`/api/ai/sessions/${encodeURIComponent(id)}${queryString({ user_id: userId })}`,
		),

	saveAiSessionMessages: (id: string, userId: string, messages: unknown[]) =>
		request<AiSession>(
			`/api/ai/sessions/${encodeURIComponent(id)}/messages`,
			jsonRequest("PUT", { user_id: userId, messages }),
		),

	deleteAiSession: (id: string, userId: string) =>
		request<void>(
			`/api/ai/sessions/${encodeURIComponent(id)}${queryString({ user_id: userId })}`,
			{ method: "DELETE" },
		),

	aiSettings: (userId: string) =>
		request<AiSettings>(`/api/ai/settings${queryString({ user_id: userId })}`),

	updateAiSettings: (input: AiSettings) =>
		request<AiSettings>("/api/ai/settings", jsonRequest("PUT", input)),

	/** OpenAI-compatible providers. `scope` gates: institutional needs an admin. */
	aiProviders: (params: { user_id: string; scope: AiScope }) =>
		request<AiProviderList>(
			`/api/ai/providers${queryString({
				user_id: params.user_id,
				scope: params.scope,
			})}`,
		),

	addAiProvider: (input: {
		user_id: string;
		scope: AiScope;
		name: string;
		base_url: string;
	}) => request<AiProvider>("/api/ai/providers", jsonRequest("POST", input)),

	updateAiProvider: (
		id: string,
		input: { user_id: string; is_enabled?: boolean; default_model?: string },
	) =>
		request<AiProvider>(`/api/ai/providers/${id}`, jsonRequest("PATCH", input)),

	deleteAiProvider: (id: string, userId: string) =>
		request<void>(
			`/api/ai/providers/${id}${queryString({ user_id: userId })}`,
			{
				method: "DELETE",
			},
		),

	/** Stores a new key encrypted and refreshes the provider's model catalogue. */
	saveProviderKey: (id: string, input: { user_id: string; api_key: string }) =>
		request<SaveKeyResult>(
			`/api/ai/providers/${id}/key`,
			jsonRequest("PUT", input),
		),

	/** Models fetched from the provider; the backend stores them. */
	providerModels: (id: string, userId: string) =>
		request<AiModelList>(
			`/api/ai/providers/${id}/models${queryString({ user_id: userId })}`,
		),

	/** Enable a stored model or promote it to the provider's default. */
	updateAiModel: (
		id: string,
		input: { user_id: string; is_enabled?: boolean; is_default?: boolean },
	) => request<void>(`/api/ai/models/${id}`, jsonRequest("PATCH", input)),

	/* --- two-factor authentication ---------------------------------------- */

	twoFactorStatus: (userId: string) =>
		request<TwoFactorStatus>(
			`/api/me/two-factor${queryString({ user_id: userId })}`,
		),

	/** Mints the secret behind the QR code; nothing changes until it is confirmed. */
	startTwoFactorSetup: (userId: string) =>
		request<TwoFactorSetup>(
			"/api/me/two-factor/setup",
			jsonRequest("POST", { user_id: userId }),
		),

	enableTwoFactor: (userId: string, code: string) =>
		request<TwoFactorEnabled>(
			"/api/me/two-factor/enable",
			jsonRequest("POST", { user_id: userId, code }),
		),

	/** Turning 2FA off is a security downgrade, so the password is re-checked. */
	disableTwoFactor: (userId: string, password: string) =>
		request<TwoFactorStatus>(
			"/api/me/two-factor/disable",
			jsonRequest("POST", { user_id: userId, password }),
		),

	regenerateRecoveryCodes: (userId: string, password: string) =>
		request<TwoFactorEnabled>(
			"/api/me/two-factor/recovery-codes",
			jsonRequest("POST", { user_id: userId, password }),
		),

	/** Administrator's way back in when both the app and the codes are gone. */
	resetUserTwoFactor: (userId: string) =>
		request<TwoFactorStatus>(`/api/users/${userId}/two-factor/reset`, {
			method: "POST",
		}),

	/** Role grants plus per-user overrides for one person. */
	userPermissions: (userId: string) =>
		request<UserPermissions>(`/api/users/${userId}/permissions`),

	/** Replaces only the per-user extras; role grants stay untouched. */
	updateUserPermissions: (
		userId: string,
		permissionKeys: string[],
		grantedBy: string,
	) =>
		request<UserPermissions>(
			`/api/users/${userId}/permissions`,
			jsonRequest("PUT", {
				permission_keys: permissionKeys,
				granted_by: grantedBy,
			}),
		),

	/* --- assignments, gradebook, record, forums, quiz attempts ---------------- */

	assignmentsForStudent: (studentId: string) =>
		request<StudentAssignment[]>(
			`/api/assignments${queryString({ student_id: studentId })}`,
		),

	assignment: (id: string, studentId?: string) =>
		request<AssignmentDetail>(
			`/api/assignments/${id}${queryString({ student_id: studentId })}`,
		),

	createAssignment: (subjectId: string, input: AssignmentInput) =>
		request<Assignment>(
			`/api/subjects/${subjectId}/assignments`,
			jsonRequest("POST", input),
		),

	updateAssignment: (id: string, input: Partial<AssignmentInput>) =>
		request<void>(`/api/assignments/${id}`, jsonRequest("PATCH", input)),

	deleteAssignment: (id: string) =>
		request<void>(`/api/assignments/${id}`, { method: "DELETE" }),

	submitAssignment: (
		assignmentId: string,
		input: { student_id: string; content?: string; file_url?: string },
	) =>
		request<{ id: string; status: string }>(
			`/api/assignments/${assignmentId}/submissions`,
			jsonRequest("POST", input),
		),

	assignmentSubmissions: (assignmentId: string) =>
		request<Submission[]>(`/api/assignments/${assignmentId}/submissions`),

	studentSubmissions: (studentId: string) =>
		request<Submission[]>(`/api/students/${studentId}/submissions`),

	gradeSubmission: (
		submissionId: string,
		input: { grader_id: string; score: number | null; feedback?: string },
	) =>
		request<{ status: string }>(
			`/api/submissions/${submissionId}`,
			jsonRequest("PATCH", input),
		),

	studentGrades: (studentId: string) =>
		request<SubjectGrade[]>(`/api/students/${studentId}/grades`),

	studentSubjectGrade: (studentId: string, subjectId: string) =>
		request<SubjectGrade>(`/api/students/${studentId}/grades/${subjectId}`),

	studentRecord: (studentId: string) =>
		request<StudentRecord>(`/api/students/${studentId}/record`),

	gradebook: (subjectId: string, userId: string) =>
		request<Gradebook>(
			`/api/subjects/${subjectId}/gradebook${queryString({ user_id: userId })}`,
		),

	createGradeComponent: (
		subjectId: string,
		input: {
			user_id: string;
			name: string;
			type: string;
			weight_percent: number;
			max_points?: number;
		},
	) =>
		request<GradeComponent>(
			`/api/subjects/${subjectId}/grade-components`,
			jsonRequest("POST", input),
		),

	updateGradeComponent: (
		id: string,
		input: {
			user_id: string;
			name?: string;
			type?: string;
			weight_percent?: number;
			max_points?: number;
		},
	) =>
		request<void>(`/api/grade-components/${id}`, jsonRequest("PATCH", input)),

	deleteGradeComponent: (id: string, userId: string) =>
		request<void>(
			`/api/grade-components/${id}${queryString({ user_id: userId })}`,
			{ method: "DELETE" },
		),

	saveGradeEntry: (
		componentId: string,
		studentId: string,
		input: { user_id: string; points: number | null; comment?: string },
	) =>
		request<void>(
			`/api/grade-components/${componentId}/entries/${studentId}`,
			jsonRequest("PUT", input),
		),

	saveOfficialResult: (
		studentId: string,
		subjectId: string,
		input: {
			user_id: string;
			attempt_no?: number;
			override_points?: number | null;
			override_grade?: number | null;
			note?: string;
			status?: string;
		},
	) =>
		request<{ status: string; grade: number | null; attempt_no: number }>(
			`/api/students/${studentId}/results/${subjectId}`,
			jsonRequest("PUT", input),
		),

	clearOfficialResult: (studentId: string, subjectId: string, userId: string) =>
		request<void>(
			`/api/students/${studentId}/results/${subjectId}${queryString({ user_id: userId })}`,
			{ method: "DELETE" },
		),

	subjectForums: (subjectId: string) =>
		request<Forum[]>(`/api/subjects/${subjectId}/forums`),

	createForum: (
		subjectId: string,
		input: { user_id: string; title: string; description?: string },
	) =>
		request<Forum>(
			`/api/subjects/${subjectId}/forums`,
			jsonRequest("POST", input),
		),

	forumThreads: (forumId: string) =>
		request<ForumThread[]>(`/api/forums/${forumId}/threads`),

	createThread: (
		forumId: string,
		input: { user_id: string; title: string; body: string },
	) =>
		request<{ id: string }>(
			`/api/forums/${forumId}/threads`,
			jsonRequest("POST", input),
		),

	thread: (threadId: string) =>
		request<{ thread: ForumThread; posts: ForumPost[] }>(
			`/api/threads/${threadId}`,
		),

	replyToThread: (threadId: string, input: { user_id: string; body: string }) =>
		request<{ id: string }>(
			`/api/threads/${threadId}/posts`,
			jsonRequest("POST", input),
		),

	deleteForumPost: (postId: string, userId: string) =>
		request<void>(`/api/posts/${postId}${queryString({ user_id: userId })}`, {
			method: "DELETE",
		}),

	quizAttempts: (quizId: string, studentId?: string) =>
		request<QuizAttempt[]>(
			`/api/quizzes/${quizId}/attempts${queryString({ student_id: studentId })}`,
		),

	startQuizAttempt: (quizId: string, studentId: string) =>
		request<QuizAttempt>(
			`/api/quizzes/${quizId}/attempts`,
			jsonRequest("POST", { student_id: studentId }),
		),

	submitQuizAttempt: (attemptId: string, answers: Record<string, string>) =>
		request<QuizAttempt>(
			`/api/attempts/${attemptId}/submit`,
			jsonRequest("POST", { answers }),
		),

	studentQuizAttempts: (studentId: string) =>
		request<QuizAttempt[]>(`/api/students/${studentId}/quiz-attempts`),
};

/** Human-readable message for any thrown value (query errors, login failures). */
export function errorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		const body = error.body;
		if (typeof body === "object" && body !== null && "error" in body) {
			return String((body as { error: unknown }).error);
		}
		return error.message;
	}
	if (error instanceof Error) return error.message;
	return "Something went wrong.";
}

/* --- AI assistant settings ------------------------------------------------ */

export type AiScope = "institutional" | "personal";

/** Per-user assistant preferences; served to everybody, scoped to its owner. */
export type UserAppearance = {
	user_id: string;
	theme: "system" | "light" | "dark";
	font: "system" | "legible" | "dyslexic";
	updated_at?: string;
};

export type AiChatModel = { id: string; model_id: string };

export type AiChatProvider = {
	id: string;
	name: string;
	scope: AiScope;
	default_model: string;
	models: AiChatModel[];
};

export type AiChatModels = {
	providers: AiChatProvider[];
	default_model_id: string | null;
};

export type AiSession = {
	id: string;
	title: string;
	updated_at: string;
	message_count: number;
};

export type AiSessionPage = { items: AiSession[]; next_page: number | null };

export type AiSessionDetail = AiSession & { messages: unknown[] };

export type AiSettings = {
	user_id: string;
	assistant_name: string;
	system_prompt: string;
	display_name: string;
	occupation: string;
	traits: string[];
	notes: string;
	/** Cap on reply length in tokens; 0 leaves it to the provider. */
	max_output_tokens: number;
	updated_at?: string;
};

export type AiProvider = {
	id: string;
	scope: AiScope;
	name: string;
	base_url: string;
	is_enabled: boolean;
	/** True once a key is stored. The key itself never leaves the backend. */
	has_key: boolean;
	/** Masked reminder like "…d41d", safe to display. */
	key_hint?: string;
	default_model?: string;
	model_count: number;
};

export type AiProviderList = { items: AiProvider[] };

export type AiModel = { id: string; model_id: string; is_enabled: boolean };

export type AiModelList = { items: AiModel[] };

export type SaveKeyResult = {
	status: string;
	key_hint: string;
	model_count: number;
	/** Present when the key saved but the model catalogue could not be read. */
	warning?: string;
};

/** Effective access: role grants plus the person's own extra permissions. */
export type UserPermissions = {
	user_id: string;
	role: string;
	role_grants: string[];
	extra_grants: string[];
	effective: string[];
};

/* --- two-factor authentication ------------------------------------------- */

/** What the settings card renders: is it on, is a setup pending, how many codes left. */
export type TwoFactorStatus = {
	user_id: string;
	enabled: boolean;
	enabled_at?: string;
	/** A secret was minted but the first code has not confirmed it yet. */
	pending: boolean;
	recovery_codes_left: number;
};

/** Enrolment start: the shared secret plus what an authenticator app expects. */
export type TwoFactorSetup = {
	user_id: string;
	secret: string;
	otpauth_uri: string;
	issuer: string;
	account: string;
	digits: number;
	period: number;
	algorithm: string;
};

/**
 * Confirmation answer: 2FA is on and the recovery codes are in the clear.
 * This is the only response that ever carries them.
 */
export type TwoFactorEnabled = {
	user_id: string;
	enabled: boolean;
	enabled_at: string;
	recovery_codes: string[];
	recovery_codes_left: number;
};

/* --- MCP apps ------------------------------------------------------------- */

/** Avatar tint of an app; each maps to one HIG system colour in the stylesheet. */
export type McpAppTone =
	| "blue"
	| "green"
	| "indigo"
	| "orange"
	| "red"
	| "teal"
	| "gray";

/** One MCP app in the catalog, with this person's connection folded in. */
export type McpApp = {
	key: string;
	name: string;
	description: string;
	category: string;
	/** 1–2 characters drawn inside the avatar. */
	glyph: string;
	tone: McpAppTone;
	/** Scopes the app is granted while connected. */
	scopes: string[];
	connected: boolean;
	connected_at?: string;
	/** Absent until the assistant has actually called the app. */
	last_used_at?: string;
};

/** GET /api/me/mcp-apps: connections (newest first) plus what is still on offer. */
export type McpAppList = {
	connected: McpApp[];
	available: McpApp[];
};

/** One action the built-in SmartLMS MCP server offers. */
export type McpTool = {
	name: string;
	title: string;
	description: string;
	/** Module the tool writes through, e.g. "subjects". */
	module: string;
	/** The permission the tool is gated on. */
	permission: string;
	input_schema: Record<string, unknown>;
	/** Whether the signed-in person holds that permission. */
	available: boolean;
};

/** The backend's own MCP server: what it can do and whether it is connected. */
export type McpServerTools = {
	server: string;
	name: string;
	endpoint: string;
	protocol: string;
	connected: boolean;
	instructions: string;
	tools: McpTool[];
	allowed: number;
	total: number;
};

/* --- assignments ---------------------------------------------------------- */

export type Assignment = {
	id: string;
	title: string;
	description?: string;
	class_id?: string;
	class_name?: string;
	scheduled_at?: string;
	due_at?: string;
	max_points: number;
	allow_late: boolean;
	submission_type: "text" | "file" | "both";
	is_published: boolean;
	week_id?: string;
};

/** Status a student sees on the assignment list. */
export type AssignmentStatus =
	| "todo"
	| "overdue"
	| "submitted"
	| "late"
	| "graded"
	| "closed";

export type StudentAssignment = Assignment & {
	subject_id: string;
	subject_name: string;
	status: AssignmentStatus;
	score: number | null;
	feedback?: string;
	submitted_at?: string;
};

export type Submission = {
	id: string;
	assignment_id: string;
	student_id: string;
	student_name?: string;
	content?: string;
	file_url?: string;
	status: "submitted" | "late" | "graded";
	score: number | null;
	max_points: number;
	feedback?: string;
	submitted_at: string;
	graded_at?: string;
};

export type AssignmentDetail = {
	assignment: Assignment;
	subject_id?: string;
	subject_name?: string;
	submission?: Submission;
};

export type AssignmentInput = {
	title: string;
	description?: string;
	class_id?: string;
	scheduled_at?: string;
	due_at?: string;
	max_points?: number;
	allow_late?: boolean;
	submission_type?: "text" | "file" | "both";
	week_id?: string;
};

/* --- gradebook ------------------------------------------------------------ */

export type GradeBand = { min: number; max: number; grade: number };

export type GradeComponent = {
	id: string;
	subject_id: string;
	name: string;
	type: "midterm" | "final" | "engagement" | "coursework" | "project" | "other";
	weight_percent: number;
	max_points: number;
	order_index: number;
	is_published: boolean;
};

export type GradebookStudent = {
	id: string;
	name: string;
	email: string;
	points: Record<string, number | null>;
	total_points: number | null;
	grade: number | null;
	coverage: number;
	is_passing: boolean;
};

export type Gradebook = {
	subject_id: string;
	subject_name: string;
	semester: string;
	school_year?: string;
	ects: number | null;
	pass_grade: number;
	components: GradeComponent[];
	students: GradebookStudent[];
};

export type SubjectGradeComponent = GradeComponent & {
	points: number | null;
	comment?: string;
};

export type SubjectGrade = {
	subject_id: string;
	subject_name: string;
	semester: string;
	school_year?: string;
	ects: number | null;
	components: SubjectGradeComponent[];
	total_points: number | null;
	grade: number | null;
	coverage: number;
	pass_grade: number;
	status: "passed" | "failed" | "in_progress" | "withdrawn";
	official_points: number | null;
	official_grade: number | null;
};

/* --- study record --------------------------------------------------------- */

export type RecordEntry = {
	subject_id: string;
	subject_name: string;
	school_year?: string;
	semester?: string;
	ects: number | null;
	attempt_no: number;
	total_points: number | null;
	grade: number | null;
	status: "passed" | "failed" | "in_progress" | "withdrawn";
	is_official: boolean;
	is_overridden: boolean;
	override_note?: string;
};

export type StudentRecord = {
	entries: RecordEntry[];
	gpa: number | null;
	credits_earned: number;
	credits_in_flight: number;
	subjects_passed: number;
	subjects_failed: number;
	pass_grade: number;
	bands: GradeBand[];
};

/* --- forums --------------------------------------------------------------- */

export type Forum = {
	id: string;
	subject_id: string;
	title: string;
	description?: string;
	is_locked: boolean;
	thread_count: number;
	post_count: number;
	last_activity?: string;
};

export type ForumThread = {
	id: string;
	forum_id: string;
	title: string;
	body: string;
	author_id: string;
	author_name: string;
	author_role: string;
	is_pinned: boolean;
	is_locked: boolean;
	reply_count: number;
	last_post_at: string;
	created_at: string;
};

export type ForumPost = {
	id: string;
	thread_id: string;
	author_id: string;
	author_name: string;
	author_role: string;
	body: string;
	created_at: string;
};

/* --- quiz attempts -------------------------------------------------------- */

export type QuizAttempt = {
	id: string;
	quiz_id: string;
	quiz_title?: string;
	subject_id?: string;
	subject_name?: string;
	score: number;
	max_score: number;
	status: "in_progress" | "completed" | "expired";
	started_at: string;
	expires_at?: string;
	completed_at?: string;
	seconds_left: number;
};
