import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	type AdmissionInput,
	type AdmissionUpdate,
	type AiScope,
	type AiSettings,
	type AssignmentInput,
	api,
	type CampusInput,
	type ClassRoomInput,
	type CourseAssignmentInput,
	type DepartmentInput,
	type FacultyInput,
	type FlashcardInput,
	type McpAppList,
	type ProgrammeInput,
	type QuizInput,
	type SchoolYearInput,
	type SessionInput,
	type SessionKind,
	type StoryInput,
	type SubjectInput,
	type TwoFactorEnabled,
	type TwoFactorStatus,
	type UserAppearance,
	type UserListParams,
	type WeekInput,
} from "./api";

export const queryKeys = {
	health: ["health"] as const,
	meta: ["meta"] as const,
	campuses: ["campuses"] as const,
	schoolYears: ["schoolYears"] as const,
	/** Prefix key: the whole faculty/department/programme tree. */
	academic: ["academic"] as const,
	programme: (id: string) => ["programme", id] as const,
	/** Prefix key: every subject's week plan. */
	weeks: ["weeks"] as const,
	subjectWeeks: (subjectId: string) => ["weeks", subjectId] as const,
	/** Prefix key: invalidating it refreshes every page of the subject list. */
	subjects: ["subjects"] as const,
	subjectsList: (params: {
		page: number;
		page_size: number;
		school_year?: string;
	}) => ["subjects", "list", params] as const,
	subject: (id: string) => ["subject", id] as const,
	users: (params: UserListParams) => ["users", params] as const,
	notifications: (userId: string) => ["notifications", userId] as const,
	aiSettings: (userId: string) => ["aiSettings", userId] as const,
	appearance: (userId: string) => ["appearance", userId] as const,
	mcpApps: (userId: string) => ["mcpApps", userId] as const,
	mcpTools: (userId: string) => ["mcpTools", userId] as const,
	twoFactor: (userId: string) => ["twoFactor", userId] as const,
	aiProviders: (userId: string, scope: AiScope) =>
		["aiProviders", userId, scope] as const,
	providerModels: (providerId: string) =>
		["aiProviderModels", providerId] as const,
	userPermissions: (userId: string) => ["userPermissions", userId] as const,
	studentAssignments: (studentId: string) =>
		["studentAssignments", studentId] as const,
	assignment: (id: string, studentId?: string) =>
		["assignment", id, studentId ?? ""] as const,
	assignmentSubmissions: (assignmentId: string) =>
		["assignmentSubmissions", assignmentId] as const,
	studentSubmissions: (studentId: string) =>
		["studentSubmissions", studentId] as const,
	gradebook: (subjectId: string) => ["gradebook", subjectId] as const,
	studentGrades: (studentId: string) => ["studentGrades", studentId] as const,
	studentRecord: (studentId: string) => ["studentRecord", studentId] as const,
	subjectForums: (subjectId: string) => ["subjectForums", subjectId] as const,
	forumThreads: (forumId: string) => ["forumThreads", forumId] as const,
	thread: (threadId: string) => ["thread", threadId] as const,
	studentQuizAttempts: (studentId: string) =>
		["studentQuizAttempts", studentId] as const,
	quizAttempts: (quizId: string, studentId?: string) =>
		["quizAttempts", quizId, studentId ?? ""] as const,
};

/** Backend liveness. Polled so the dashboard card reflects reality. */
export function useHealth() {
	return useQuery({
		queryKey: queryKeys.health,
		queryFn: api.health,
		refetchInterval: 30_000,
		staleTime: 10_000,
		retry: 1,
	});
}

export function useMeta() {
	return useQuery({
		queryKey: queryKeys.meta,
		queryFn: api.meta,
		staleTime: 60_000,
	});
}

export function useCampuses() {
	return useQuery({
		queryKey: queryKeys.campuses,
		queryFn: api.campuses,
		staleTime: 30_000,
	});
}

/** The academic calendar: every year, with the current one flagged. */
export function useSchoolYears() {
	return useQuery({
		queryKey: queryKeys.schoolYears,
		queryFn: api.schoolYears,
		staleTime: 30_000,
	});
}

/** Create, edit, activate and remove school years. */
export function useSchoolYearMutations() {
	const queryClient = useQueryClient();
	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: queryKeys.schoolYears });
		// Subject rows name their year, and the subject form's year select is
		// built from the catalog, so both follow a calendar change.
		void queryClient.invalidateQueries({ queryKey: queryKeys.subjects });
	};

	const createSchoolYear = useMutation({
		mutationFn: (input: SchoolYearInput) => api.createSchoolYear(input),
		onSuccess: refresh,
		onError: refresh,
	});

	const updateSchoolYear = useMutation({
		mutationFn: ({
			id,
			input,
		}: {
			id: string;
			input: Partial<SchoolYearInput>;
		}) => api.updateSchoolYear(id, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const activateSchoolYear = useMutation({
		mutationFn: (id: string) => api.activateSchoolYear(id),
		onSuccess: refresh,
		onError: refresh,
	});

	const deleteSchoolYear = useMutation({
		mutationFn: (id: string) => api.deleteSchoolYear(id),
		onSuccess: refresh,
		onError: refresh,
	});

	return {
		createSchoolYear,
		updateSchoolYear,
		activateSchoolYear,
		deleteSchoolYear,
	};
}

/** The faculty/department/programme tree, with the counts the page acts on. */
export function useAcademicTree() {
	return useQuery({
		queryKey: queryKeys.academic,
		queryFn: api.academic,
		staleTime: 30_000,
	});
}

/** The week-by-week plan of a subject, with the content of each week. */
export function useWeeks(subjectId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.subjectWeeks(subjectId ?? ""),
		queryFn: () => api.weeks(subjectId ?? ""),
		enabled: Boolean(subjectId),
		staleTime: 15_000,
	});
}

/** Create, edit and remove the weeks of a subject. */
export function useWeekMutations(subjectId: string) {
	const queryClient = useQueryClient();
	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: queryKeys.weeks });
		// A week is shown on the content too, and moving a week changes the subject.
		void queryClient.invalidateQueries({
			queryKey: queryKeys.subject(subjectId),
		});
	};

	const create = useMutation({
		mutationFn: (input: WeekInput) => api.createWeek(subjectId, input),
		onSuccess: refresh,
		onError: refresh,
	});
	const update = useMutation({
		mutationFn: ({ id, input }: { id: string; input: Partial<WeekInput> }) =>
			api.updateWeek(id, input),
		onSuccess: refresh,
		onError: refresh,
	});
	const remove = useMutation({
		mutationFn: (id: string) => api.deleteWeek(id),
		onSuccess: refresh,
		onError: refresh,
	});

	return { create, update, remove };
}

/** One programme: its curriculum and the students admitted to it. */
export function useProgramme(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.programme(id ?? ""),
		queryFn: () => api.programme(id ?? ""),
		enabled: Boolean(id),
		staleTime: 15_000,
	});
}

/**
 * Structure, admission and curriculum mutations. Every outcome refreshes the
 * tree, and the programme itself when there is one on screen: a course
 * assignment changes both the counts and the curriculum.
 */
export function useAcademicMutations(programmeId?: string) {
	const queryClient = useQueryClient();
	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: queryKeys.academic });
		if (programmeId) {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.programme(programmeId),
			});
		}
		// A course carries its programme and year of study, so the subject screens
		// follow too.
		void queryClient.invalidateQueries({ queryKey: queryKeys.subjects });
	};

	const createFaculty = useMutation({
		mutationFn: (input: FacultyInput) => api.createFaculty(input),
		onSuccess: refresh,
		onError: refresh,
	});
	const updateFaculty = useMutation({
		mutationFn: ({ id, input }: { id: string; input: Partial<FacultyInput> }) =>
			api.updateFaculty(id, input),
		onSuccess: refresh,
		onError: refresh,
	});
	const deleteFaculty = useMutation({
		mutationFn: (id: string) => api.deleteFaculty(id),
		onSuccess: refresh,
		onError: refresh,
	});

	const createDepartment = useMutation({
		mutationFn: (input: DepartmentInput) => api.createDepartment(input),
		onSuccess: refresh,
		onError: refresh,
	});
	const updateDepartment = useMutation({
		mutationFn: ({
			id,
			input,
		}: {
			id: string;
			input: Partial<DepartmentInput>;
		}) => api.updateDepartment(id, input),
		onSuccess: refresh,
		onError: refresh,
	});
	const deleteDepartment = useMutation({
		mutationFn: (id: string) => api.deleteDepartment(id),
		onSuccess: refresh,
		onError: refresh,
	});

	const createProgramme = useMutation({
		mutationFn: (input: ProgrammeInput) => api.createProgramme(input),
		onSuccess: refresh,
		onError: refresh,
	});
	const updateProgramme = useMutation({
		mutationFn: ({
			id,
			input,
		}: {
			id: string;
			input: Partial<ProgrammeInput>;
		}) => api.updateProgramme(id, input),
		onSuccess: refresh,
		onError: refresh,
	});
	const deleteProgramme = useMutation({
		mutationFn: (id: string) => api.deleteProgramme(id),
		onSuccess: refresh,
		onError: refresh,
	});

	const admitStudent = useMutation({
		mutationFn: ({ id, input }: { id: string; input: AdmissionInput }) =>
			api.admitStudent(id, input),
		onSuccess: refresh,
		onError: refresh,
	});
	const updateAdmission = useMutation({
		mutationFn: ({ id, input }: { id: string; input: AdmissionUpdate }) =>
			api.updateAdmission(id, input),
		onSuccess: refresh,
		onError: refresh,
	});
	const removeAdmission = useMutation({
		mutationFn: (id: string) => api.removeAdmission(id),
		onSuccess: refresh,
		onError: refresh,
	});

	const assignCourse = useMutation({
		mutationFn: ({ id, input }: { id: string; input: CourseAssignmentInput }) =>
			api.assignCourse(id, input),
		onSuccess: refresh,
		onError: refresh,
	});
	const unassignCourse = useMutation({
		mutationFn: ({ id, subjectId }: { id: string; subjectId: string }) =>
			api.unassignCourse(id, subjectId),
		onSuccess: refresh,
		onError: refresh,
	});

	return {
		createFaculty,
		updateFaculty,
		deleteFaculty,
		createDepartment,
		updateDepartment,
		deleteDepartment,
		createProgramme,
		updateProgramme,
		deleteProgramme,
		admitStudent,
		updateAdmission,
		removeAdmission,
		assignCourse,
		unassignCourse,
	};
}

export function useSubjects(params: {
	page: number;
	page_size: number;
	school_year?: string;
}) {
	return useQuery({
		queryKey: queryKeys.subjectsList(params),
		queryFn: () => api.subjects(params),
		staleTime: 30_000,
		// Paging keeps the previous page on screen instead of flashing a skeleton.
		placeholderData: keepPreviousData,
	});
}

export function useUsers(params: UserListParams) {
	return useQuery({
		queryKey: queryKeys.users(params),
		queryFn: () => api.users(params),
		staleTime: 20_000,
		placeholderData: keepPreviousData,
	});
}

export function useNotifications(userId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.notifications(userId ?? ""),
		queryFn: () => api.notifications(userId ?? ""),
		enabled: Boolean(userId),
		staleTime: 20_000,
		refetchInterval: 60_000,
	});
}

/** Read/unread mutations; every outcome refreshes the notification feed. */
export function useNotificationMutations(userId: string | undefined) {
	const queryClient = useQueryClient();
	const refresh = () => {
		if (!userId) return;
		void queryClient.invalidateQueries({
			queryKey: queryKeys.notifications(userId),
		});
	};

	const markRead = useMutation({
		mutationFn: (id: string) => api.markNotificationRead(id),
		onSuccess: refresh,
		onError: refresh,
	});

	const markAllRead = useMutation({
		mutationFn: () => api.markAllNotificationsRead(userId ?? ""),
		onSuccess: refresh,
		onError: refresh,
	});

	return { markRead, markAllRead };
}

export function useSubject(id: string) {
	return useQuery({
		queryKey: queryKeys.subject(id),
		queryFn: () => api.subject(id),
		staleTime: 15_000,
	});
}

/**
 * Subject, content and subject-tree mutations. Every success refreshes the subject
 * list and the subject it belongs to.
 */
export function useSubjectMutations(subjectId?: string) {
	const queryClient = useQueryClient();
	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: queryKeys.subjects });
		// A course carries its programme, so a create, rename or delete changes
		// what the academic structure shows as well.
		void queryClient.invalidateQueries({ queryKey: queryKeys.academic });
		// Content created, moved or deleted changes its week's contents.
		void queryClient.invalidateQueries({ queryKey: queryKeys.weeks });
		if (subjectId) {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.subject(subjectId),
			});
		}
	};

	const createSubject = useMutation({
		mutationFn: (input: SubjectInput) => api.createSubject(input),
		onSuccess: refresh,
		onError: refresh,
	});

	const updateSubject = useMutation({
		mutationFn: ({ id, input }: { id: string; input: Partial<SubjectInput> }) =>
			api.updateSubject(id, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const deleteSubject = useMutation({
		mutationFn: (id: string) => api.deleteSubject(id),
		onSuccess: refresh,
		onError: refresh,
	});

	const createSession = useMutation({
		mutationFn: ({
			kind,
			subjectId: id,
			input,
		}: {
			kind: SessionKind;
			subjectId: string;
			input: SessionInput;
		}) => api.createSession(kind, id, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const updateSession = useMutation({
		mutationFn: ({
			kind,
			id,
			input,
		}: {
			kind: SessionKind;
			id: string;
			input: Partial<SessionInput>;
		}) => api.updateSession(kind, id, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const deleteSession = useMutation({
		mutationFn: ({ kind, id }: { kind: SessionKind; id: string }) =>
			api.deleteSession(kind, id),
		onSuccess: refresh,
		onError: refresh,
	});

	const createQuiz = useMutation({
		mutationFn: ({ id, input }: { id: string; input: QuizInput }) =>
			api.createQuiz(id, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const updateQuiz = useMutation({
		mutationFn: ({ id, input }: { id: string; input: Partial<QuizInput> }) =>
			api.updateQuiz(id, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const deleteQuiz = useMutation({
		mutationFn: (id: string) => api.deleteQuiz(id),
		onSuccess: refresh,
		onError: refresh,
	});

	const createFlashcard = useMutation({
		mutationFn: ({ id, input }: { id: string; input: FlashcardInput }) =>
			api.createFlashcard(id, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const updateFlashcard = useMutation({
		mutationFn: ({
			id,
			input,
		}: {
			id: string;
			input: Partial<FlashcardInput>;
		}) => api.updateFlashcard(id, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const deleteFlashcard = useMutation({
		mutationFn: (id: string) => api.deleteFlashcard(id),
		onSuccess: refresh,
		onError: refresh,
	});

	return {
		createSubject,
		updateSubject,
		deleteSubject,
		createSession,
		updateSession,
		deleteSession,
		createQuiz,
		updateQuiz,
		deleteQuiz,
		createFlashcard,
		updateFlashcard,
		deleteFlashcard,
	};
}

/**
 * All campus-tree mutations. Each one invalidates ["campuses"] on success, so
 * the list re-renders from the server's state with no page reload.
 */
export function useCampusMutations() {
	const queryClient = useQueryClient();
	const refresh = () =>
		queryClient.invalidateQueries({ queryKey: queryKeys.campuses });

	const createCampus = useMutation({
		mutationFn: (input: CampusInput) => api.createCampus(input),
		onSuccess: refresh,
		onError: refresh,
	});

	const updateCampus = useMutation({
		mutationFn: ({ id, input }: { id: string; input: Partial<CampusInput> }) =>
			api.updateCampus(id, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const deleteCampus = useMutation({
		mutationFn: (id: string) => api.deleteCampus(id),
		onSuccess: refresh,
		onError: refresh,
	});

	const createStory = useMutation({
		mutationFn: ({
			campusId,
			input,
		}: {
			campusId: string;
			input: StoryInput;
		}) => api.createStory(campusId, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const updateStory = useMutation({
		mutationFn: ({ id, input }: { id: string; input: Partial<StoryInput> }) =>
			api.updateStory(id, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const deleteStory = useMutation({
		mutationFn: (id: string) => api.deleteStory(id),
		onSuccess: refresh,
		onError: refresh,
	});

	const createClass = useMutation({
		mutationFn: ({
			storyId,
			input,
		}: {
			storyId: string;
			input: ClassRoomInput;
		}) => api.createClass(storyId, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const updateClass = useMutation({
		mutationFn: ({
			id,
			input,
		}: {
			id: string;
			input: Partial<ClassRoomInput>;
		}) => api.updateClass(id, input),
		onSuccess: refresh,
		onError: refresh,
	});

	const deleteClass = useMutation({
		mutationFn: (id: string) => api.deleteClass(id),
		onSuccess: refresh,
		onError: refresh,
	});

	return {
		createCampus,
		updateCampus,
		deleteCampus,
		createStory,
		updateStory,
		deleteStory,
		createClass,
		updateClass,
		deleteClass,
	};
}

/* --- Per-user appearance --------------------------------------------------- */

export function useAppearance(userId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.appearance(userId ?? ""),
		queryFn: () => api.appearance(userId ?? ""),
		enabled: Boolean(userId),
		staleTime: Infinity,
	});
}

export function useUpdateAppearance(userId: string | undefined) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UserAppearance) => api.updateAppearance(input),
		onSuccess: (saved) => {
			if (!userId) return;
			queryClient.setQueryData(queryKeys.appearance(userId), saved);
		},
	});
}

/* --- MCP apps (connections shown on the profile) --------------------------- */

export function useMcpApps(userId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.mcpApps(userId ?? ""),
		queryFn: () => api.mcpApps(userId ?? ""),
		enabled: Boolean(userId),
		staleTime: 30_000,
	});
}

/** Connect and revoke both answer with the fresh catalog, so one cache write covers both. */
export function useConnectMcpApp(userId: string | undefined) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (appKey: string) =>
			api.connectMcpApp({ user_id: userId ?? "", app_key: appKey }),
		onSuccess: (list) => {
			if (userId)
				queryClient.setQueryData<McpAppList>(queryKeys.mcpApps(userId), list);
			// The MCP tab reads the same switch through the server catalogue.
			void queryClient.invalidateQueries({
				queryKey: queryKeys.mcpTools(userId ?? ""),
			});
		},
	});
}

/**
 * The built-in SmartLMS MCP server's catalogue. It answers per permission, so
 * the tab can show which tools this person may actually call.
 */
export function useMcpServerTools(userId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.mcpTools(userId ?? ""),
		queryFn: () => api.mcpTools(userId ?? ""),
		enabled: Boolean(userId),
		staleTime: 60_000,
	});
}

export function useDisconnectMcpApp(userId: string | undefined) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (appKey: string) => api.disconnectMcpApp(appKey, userId ?? ""),
		onSuccess: (list) => {
			if (userId)
				queryClient.setQueryData<McpAppList>(queryKeys.mcpApps(userId), list);
			void queryClient.invalidateQueries({
				queryKey: queryKeys.mcpTools(userId ?? ""),
			});
		},
	});
}

/* --- Two-factor authentication -------------------------------------------- */

/** Whether this account has 2FA on, and how many recovery codes are left. */
export function useTwoFactor(userId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.twoFactor(userId ?? ""),
		queryFn: () => api.twoFactorStatus(userId ?? ""),
		enabled: Boolean(userId),
		staleTime: 30_000,
	});
}

/** The confirmation answer doubles as the new status, less the pending flag. */
function statusFromEnabled(enabled: TwoFactorEnabled): TwoFactorStatus {
	return {
		user_id: enabled.user_id,
		enabled: enabled.enabled,
		enabled_at: enabled.enabled_at,
		pending: false,
		recovery_codes_left: enabled.recovery_codes_left,
	};
}

/**
 * Enrolment, confirmation, disabling and recovery codes: every step answers
 * with the account's new state, so one cache write keeps the card honest.
 */
export function useTwoFactorMutations(userId: string | undefined) {
	const queryClient = useQueryClient();

	const writeStatus = (status: TwoFactorStatus) => {
		if (userId) {
			queryClient.setQueryData<TwoFactorStatus>(
				queryKeys.twoFactor(userId),
				status,
			);
		}
	};

	const setup = useMutation({
		mutationFn: () => api.startTwoFactorSetup(userId ?? ""),
		onSuccess: (data) => {
			// A minted secret is pending until a code confirms it.
			writeStatus({
				user_id: data.user_id,
				enabled: false,
				pending: true,
				recovery_codes_left: 0,
			});
		},
	});

	const enable = useMutation({
		mutationFn: (code: string) => api.enableTwoFactor(userId ?? "", code),
		onSuccess: (data) => writeStatus(statusFromEnabled(data)),
	});

	const disable = useMutation({
		mutationFn: (password: string) =>
			api.disableTwoFactor(userId ?? "", password),
		onSuccess: writeStatus,
	});

	const regenerate = useMutation({
		mutationFn: (password: string) =>
			api.regenerateRecoveryCodes(userId ?? "", password),
		onSuccess: (data) => writeStatus(statusFromEnabled(data)),
	});

	return { setup, enable, disable, regenerate };
}

/**
 * An administrator clearing someone else's 2FA. The users table is what shows
 * the outcome, so it is refetched rather than patched by hand.
 */
export function useResetUserTwoFactor() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (targetUserId: string) => api.resetUserTwoFactor(targetUserId),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
	});
}

/* --- AI assistant settings and providers ---------------------------------- */

export function useAiSettings(userId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.aiSettings(userId ?? ""),
		queryFn: () => api.aiSettings(userId ?? ""),
		enabled: Boolean(userId),
		staleTime: 60_000,
	});
}

export function useAiProviderList(userId: string | undefined, scope: AiScope) {
	return useQuery({
		queryKey: queryKeys.aiProviders(userId ?? "", scope),
		queryFn: () => api.aiProviders({ user_id: userId ?? "", scope }),
		enabled: Boolean(userId),
	});
}

/** Stored model catalogue for one provider. */
export function useProviderModels(
	providerId: string | undefined,
	userId: string | undefined,
) {
	return useQuery({
		queryKey: queryKeys.providerModels(providerId ?? ""),
		queryFn: () => api.providerModels(providerId ?? "", userId ?? ""),
		enabled: Boolean(providerId && userId),
	});
}

/** Provider + model mutations; every outcome refreshes the provider list. */
export function useAiProviderMutations(userId: string | undefined) {
	const queryClient = useQueryClient();
	const refreshProviders = () => {
		if (!userId) return;
		void queryClient.invalidateQueries({
			queryKey: ["aiProviders", userId],
		});
	};

	const saveKey = useMutation({
		mutationFn: (input: { providerId: string; apiKey: string }) =>
			api.saveProviderKey(input.providerId, {
				user_id: userId ?? "",
				api_key: input.apiKey,
			}),
		onSuccess: refreshProviders,
		onError: refreshProviders,
	});

	const toggleProvider = useMutation({
		mutationFn: (input: { providerId: string; isEnabled: boolean }) =>
			api.updateAiProvider(input.providerId, {
				user_id: userId ?? "",
				is_enabled: input.isEnabled,
			}),
		onSuccess: refreshProviders,
		onError: refreshProviders,
	});

	const deleteProvider = useMutation({
		mutationFn: (providerId: string) =>
			api.deleteAiProvider(providerId, userId ?? ""),
		onSuccess: refreshProviders,
		onError: refreshProviders,
	});

	const updateModel = useMutation({
		mutationFn: (input: {
			providerId: string;
			modelId: string;
			isEnabled?: boolean;
			isDefault?: boolean;
		}) =>
			api.updateAiModel(input.modelId, {
				user_id: userId ?? "",
				is_enabled: input.isEnabled,
				is_default: input.isDefault,
			}),
		onSuccess: () => {
			if (!userId) return;
			void queryClient.invalidateQueries({
				queryKey: ["aiProviderModels"],
			});
			refreshProviders();
		},
		onError: refreshProviders,
	});

	return { saveKey, toggleProvider, deleteProvider, updateModel };
}

/** Saves the per-user assistant preferences draft. */
export function useUpdateAiSettings(userId: string | undefined) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: AiSettings) => api.updateAiSettings(input),
		onSuccess: (saved) => {
			if (!userId) return;
			queryClient.setQueryData(queryKeys.aiSettings(userId), saved);
		},
	});
}

/* --- Per-user permission overrides ---------------------------------------- */

export function useUserPermissions(userId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.userPermissions(userId ?? ""),
		queryFn: () => api.userPermissions(userId ?? ""),
		enabled: Boolean(userId),
	});
}

export function useUpdateUserPermissions(userId: string | undefined) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: { permissionKeys: string[]; grantedBy: string }) =>
			api.updateUserPermissions(
				userId ?? "",
				input.permissionKeys,
				input.grantedBy,
			),
		onSuccess: (saved) => {
			if (!userId) return;
			queryClient.setQueryData(queryKeys.userPermissions(userId), saved);
		},
	});
}

/* --- assignments ---------------------------------------------------------- */

export function useStudentAssignments(studentId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.studentAssignments(studentId ?? ""),
		queryFn: () => api.assignmentsForStudent(studentId ?? ""),
		enabled: Boolean(studentId),
		staleTime: 15_000,
	});
}

export function useAssignment(id: string, studentId?: string) {
	return useQuery({
		queryKey: queryKeys.assignment(id, studentId),
		queryFn: () => api.assignment(id, studentId),
		enabled: Boolean(id),
	});
}

export function useAssignmentSubmissions(assignmentId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.assignmentSubmissions(assignmentId ?? ""),
		queryFn: () => api.assignmentSubmissions(assignmentId ?? ""),
		enabled: Boolean(assignmentId),
	});
}

export function useStudentSubmissions(studentId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.studentSubmissions(studentId ?? ""),
		queryFn: () => api.studentSubmissions(studentId ?? ""),
		enabled: Boolean(studentId),
	});
}

/** Every assignment mutation refreshes the lists it can affect. */
export function useAssignmentMutations(subjectId?: string) {
	const queryClient = useQueryClient();
	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: ["studentAssignments"] });
		void queryClient.invalidateQueries({ queryKey: ["assignmentSubmissions"] });
		void queryClient.invalidateQueries({ queryKey: ["studentSubmissions"] });
		void queryClient.invalidateQueries({ queryKey: ["assignment"] });
		void queryClient.invalidateQueries({ queryKey: queryKeys.weeks });
		if (subjectId)
			void queryClient.invalidateQueries({
				queryKey: queryKeys.subject(subjectId),
			});
	};

	const submit = useMutation({
		mutationFn: (vars: {
			assignmentId: string;
			input: { student_id: string; content?: string; file_url?: string };
		}) => api.submitAssignment(vars.assignmentId, vars.input),
		onSuccess: refresh,
	});
	const grade = useMutation({
		mutationFn: (vars: {
			submissionId: string;
			grader_id: string;
			score: number | null;
			feedback?: string;
		}) => api.gradeSubmission(vars.submissionId, vars),
		onSuccess: refresh,
	});
	const create = useMutation({
		mutationFn: (vars: { subjectId: string; input: AssignmentInput }) =>
			api.createAssignment(vars.subjectId, vars.input),
		onSuccess: refresh,
	});
	const update = useMutation({
		mutationFn: (vars: { id: string; input: Partial<AssignmentInput> }) =>
			api.updateAssignment(vars.id, vars.input),
		onSuccess: refresh,
	});
	const remove = useMutation({
		mutationFn: api.deleteAssignment,
		onSuccess: refresh,
	});

	return { submit, grade, create, update, remove };
}

/* --- gradebook ------------------------------------------------------------ */

export function useGradebook(
	subjectId: string | undefined,
	userId: string | undefined,
) {
	return useQuery({
		queryKey: queryKeys.gradebook(subjectId ?? ""),
		queryFn: () => api.gradebook(subjectId ?? "", userId ?? ""),
		enabled: Boolean(subjectId && userId),
		staleTime: 10_000,
	});
}

export function useStudentGrades(studentId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.studentGrades(studentId ?? ""),
		queryFn: () => api.studentGrades(studentId ?? ""),
		enabled: Boolean(studentId),
	});
}

export function useStudentRecord(studentId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.studentRecord(studentId ?? ""),
		queryFn: () => api.studentRecord(studentId ?? ""),
		enabled: Boolean(studentId),
	});
}

export function useGradebookMutations(subjectId?: string, studentId?: string) {
	const queryClient = useQueryClient();
	const refresh = () => {
		if (subjectId)
			void queryClient.invalidateQueries({
				queryKey: queryKeys.gradebook(subjectId),
			});
		void queryClient.invalidateQueries({ queryKey: ["studentGrades"] });
		void queryClient.invalidateQueries({ queryKey: ["studentRecord"] });
		if (studentId)
			void queryClient.invalidateQueries({
				queryKey: queryKeys.studentRecord(studentId),
			});
	};

	const createComponent = useMutation({
		mutationFn: (vars: {
			subjectId: string;
			input: {
				user_id: string;
				name: string;
				type: string;
				weight_percent: number;
				max_points?: number;
			};
		}) => api.createGradeComponent(vars.subjectId, vars.input),
		onSuccess: refresh,
	});
	const updateComponent = useMutation({
		mutationFn: (vars: {
			id: string;
			input: {
				user_id: string;
				name?: string;
				type?: string;
				weight_percent?: number;
				max_points?: number;
			};
		}) => api.updateGradeComponent(vars.id, vars.input),
		onSuccess: refresh,
	});
	const deleteComponent = useMutation({
		mutationFn: (vars: { id: string; user_id: string }) =>
			api.deleteGradeComponent(vars.id, vars.user_id),
		onSuccess: refresh,
	});
	const saveEntry = useMutation({
		mutationFn: (vars: {
			componentId: string;
			studentId: string;
			input: { user_id: string; points: number | null; comment?: string };
		}) => api.saveGradeEntry(vars.componentId, vars.studentId, vars.input),
		onSuccess: refresh,
	});
	const saveOfficial = useMutation({
		mutationFn: (vars: {
			studentId: string;
			subjectId: string;
			input: {
				user_id: string;
				attempt_no?: number;
				override_points?: number | null;
				override_grade?: number | null;
				note?: string;
				status?: string;
			};
		}) => api.saveOfficialResult(vars.studentId, vars.subjectId, vars.input),
		onSuccess: refresh,
	});
	const clearOfficial = useMutation({
		mutationFn: (vars: {
			studentId: string;
			subjectId: string;
			user_id: string;
		}) => api.clearOfficialResult(vars.studentId, vars.subjectId, vars.user_id),
		onSuccess: refresh,
	});

	return {
		createComponent,
		updateComponent,
		deleteComponent,
		saveEntry,
		saveOfficial,
		clearOfficial,
	};
}

/* --- forums --------------------------------------------------------------- */

export function useSubjectForums(subjectId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.subjectForums(subjectId ?? ""),
		queryFn: () => api.subjectForums(subjectId ?? ""),
		enabled: Boolean(subjectId),
	});
}

export function useForumThreads(forumId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.forumThreads(forumId ?? ""),
		queryFn: () => api.forumThreads(forumId ?? ""),
		enabled: Boolean(forumId),
	});
}

export function useThread(threadId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.thread(threadId ?? ""),
		queryFn: () => api.thread(threadId ?? ""),
		enabled: Boolean(threadId),
	});
}

export function useForumMutations(
	subjectId?: string,
	forumId?: string,
	threadId?: string,
) {
	const queryClient = useQueryClient();
	const refresh = () => {
		if (subjectId)
			void queryClient.invalidateQueries({
				queryKey: queryKeys.subjectForums(subjectId),
			});
		if (forumId)
			void queryClient.invalidateQueries({
				queryKey: queryKeys.forumThreads(forumId),
			});
		if (threadId)
			void queryClient.invalidateQueries({
				queryKey: queryKeys.thread(threadId),
			});
	};

	const createForum = useMutation({
		mutationFn: (vars: {
			subjectId: string;
			input: { user_id: string; title: string; description?: string };
		}) => api.createForum(vars.subjectId, vars.input),
		onSuccess: refresh,
	});
	const createThread = useMutation({
		mutationFn: (vars: {
			forumId: string;
			input: { user_id: string; title: string; body: string };
		}) => api.createThread(vars.forumId, vars.input),
		onSuccess: refresh,
	});
	const reply = useMutation({
		mutationFn: (vars: {
			threadId: string;
			input: { user_id: string; body: string };
		}) => api.replyToThread(vars.threadId, vars.input),
		onSuccess: refresh,
	});
	const removePost = useMutation({
		mutationFn: (vars: { postId: string; user_id: string }) =>
			api.deleteForumPost(vars.postId, vars.user_id),
		onSuccess: refresh,
	});

	return { createForum, createThread, reply, removePost };
}

/* --- quiz attempts -------------------------------------------------------- */

export function useStudentQuizAttempts(studentId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.studentQuizAttempts(studentId ?? ""),
		queryFn: () => api.studentQuizAttempts(studentId ?? ""),
		enabled: Boolean(studentId),
	});
}

export function useQuizAttempts(
	quizId: string | undefined,
	studentId?: string,
) {
	return useQuery({
		queryKey: queryKeys.quizAttempts(quizId ?? "", studentId),
		queryFn: () => api.quizAttempts(quizId ?? "", studentId),
		enabled: Boolean(quizId),
	});
}

export function useQuizAttemptMutations(quizId?: string) {
	const queryClient = useQueryClient();
	const refresh = () => {
		if (quizId)
			void queryClient.invalidateQueries({ queryKey: ["quizAttempts"] });
		void queryClient.invalidateQueries({ queryKey: ["studentQuizAttempts"] });
	};
	const start = useMutation({
		mutationFn: (vars: { quizId: string; student_id: string }) =>
			api.startQuizAttempt(vars.quizId, vars.student_id),
		onSuccess: refresh,
	});
	const submit = useMutation({
		mutationFn: (vars: {
			attemptId: string;
			answers: Record<string, string>;
		}) => api.submitQuizAttempt(vars.attemptId, vars.answers),
		onSuccess: refresh,
	});
	return { start, submit };
}
