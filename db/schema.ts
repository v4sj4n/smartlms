import {
  pgTable,
  uuid,
  text,
  varchar,
  pgEnum,
  timestamp,
  integer,
  boolean,
  date,
  uniqueIndex,
  primaryKey,
  jsonb,
  index,
  customType,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { type AdapterAccount } from "next-auth/adapters"

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1024)"
  },
  toDriver(value) {
    return `[${value.join(",")}]`
  },
})

/* ==========================================================================
   1. USERS & AUTH DOMAIN
   ========================================================================== */

export const userRoleEnum = pgEnum("user_role", [
  "ADMIN",
  "PROFESSOR",
  "STUDENT",
])

export const userAiToneEnum = pgEnum("user_ai_tone", [
  "Default",
  "Professional",
  "Friendly",
  "Candid",
  "Quirky",
  "Efficient",
  "Cynical",
])

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: varchar("email", { length: 256 }).notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  nickname: varchar("nickname", { length: 64 }),
  bio: text("bio"),
  aiTone: userAiToneEnum("ai_tone").notNull().default("Default"),
  aiCustomInstructions: text("ai_custom_instructions"),
  role: userRoleEnum("role").notNull().default("STUDENT"),
  fullName: text("full_name"),
  phone: varchar("phone", { length: 256 }),
  // Professor availability fields
  availability:
    jsonb("availability").$type<
      Array<{ dayOfWeek: string; startTime: string; endTime: string }>
    >(),
  maxWeeklyHours: integer("max_weekly_hours").default(20),
  preferredTimeSlots: jsonb("preferred_time_slots").$type<
    Array<{
      dayOfWeek: string
      startTime: string
      endTime: string
      priority: number
    }>
  >(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Stores password hashes for credentials authentication in a dedicated table to avoid bloating/leaking on basic user reads.
export const userAuth = pgTable("user_auth", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  passwordHash: text("password_hash").notNull(),
})

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    {
      compoundKey: primaryKey({
        columns: [account.provider, account.providerAccountId],
      }),
    },
  ]
)

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

/* ==========================================================================
   2. COURSES & WEEKS DOMAIN
   ========================================================================== */

export const semesterEnum = pgEnum("semester", ["FIRST", "SECOND"])

export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  teacherId: uuid("teacher_id").references(() => users.id, {
    onDelete: "set null",
  }),
  // Academic context — nullable so existing courses are not broken
  schoolYearId: uuid("school_year_id"), // FK added after school_years table
  studyProgramId: uuid("study_program_id"), // FK added after study_programs table
  semester: semesterEnum("semester"),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Nested chronological weeks structure for the curriculum rather than dynamic unstructured modules
export const courseWeeks = pgTable("course_weeks", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .notNull(),
  weekNumber: integer("week_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Schedule for courses — day of week, time, location
export const dayOfWeekEnum = pgEnum("day_of_week", [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
])

export const sessionTypeEnum = pgEnum("session_type", ["lecture", "seminar"])

export const courseSchedules = pgTable(
  "course_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    dayOfWeek: dayOfWeekEnum("day_of_week").notNull(),
    startTime: text("start_time").notNull(), // Format: "HH:MM" (24h)
    endTime: text("end_time").notNull(), // Format: "HH:MM" (24h)
    room: text("room"),
    building: text("building"),
    // New academic structure fields
    groupId: uuid("group_id").references(() => studentGroups.id, {
      onDelete: "set null",
    }),
    subjectAssignmentId: uuid("subject_assignment_id").references(
      () => subjectAssignments.id,
      { onDelete: "set null" }
    ),
    academicYearId: uuid("academic_year_id").references(() => schoolYears.id, {
      onDelete: "set null",
    }),
    sessionType: sessionTypeEnum("session_type").default("lecture"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_schedules_group").on(t.groupId),
    index("idx_schedules_subject_assignment").on(t.subjectAssignmentId),
    index("idx_schedules_academic_year").on(t.academicYearId),
    index("idx_schedules_year_day_time").on(
      t.academicYearId,
      t.dayOfWeek,
      t.startTime
    ),
  ]
)

/* ==========================================================================
   3. QUIZZES DOMAIN
   ========================================================================== */

export const quizTypeEnum = pgEnum("quiz_type", ["graded", "practice"])

export const fileStatusEnum = pgEnum("file_status", [
  "UPLOADING",
  "UPLOADED",
  "PROCESSING",
  "READY",
  "FAILED",
  "DELETED",
])

export const generationOriginEnum = pgEnum("generation_origin", [
  "MANUAL",
  "AI",
])

export const contentStatusEnum = pgEnum("content_status", [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
])

export const chatbotRoleEnum = pgEnum("chatbot_role", [
  "system",
  "user",
  "assistant",
])

export const quizQuestionTypeEnum = pgEnum("quiz_question_type", [
  "mcq",
  "true_false",
  "short_answer",
])

export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"])

export const quizzes = pgTable("quizzes", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekId: uuid("week_id")
    .references(() => courseWeeks.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: quizTypeEnum("type").default("graded").notNull(),
  timeLimitMinutes: integer("time_limit_minutes"),
  sourceFileId: uuid("source_file_id").references(() => files.id, {
    onDelete: "set null",
  }),
  origin: generationOriginEnum("origin").default("MANUAL").notNull(),
  status: contentStatusEnum("status").default("DRAFT").notNull(),
  difficulty: difficultyEnum("difficulty").default("medium").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const questionTypeEnum = pgEnum("question_type", [
  "true_false",
  "multiple_choice",
])

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizId: uuid("quiz_id")
    .references(() => quizzes.id, { onDelete: "cascade" })
    .notNull(),
  type: questionTypeEnum("type").notNull(),
  content: text("content").notNull(),
  points: integer("points").default(1).notNull(),
  orderIndex: integer("order_index").notNull(),
  sourceChunkIds: jsonb("source_chunk_ids")
    .$type<string[]>()
    .default([])
    .notNull(),
  sourceFileId: uuid("source_file_id").references(() => files.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const questionOptions = pgTable("question_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .references(() => questions.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  isCorrect: boolean("is_correct").default(false).notNull(),
  explanation: text("explanation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    quizId: uuid("quiz_id")
      .references(() => quizzes.id, { onDelete: "cascade" })
      .notNull(),
    score: integer("score").default(0).notNull(),
    completedAt: timestamp("completed_at").notNull(),
    reviewSuggestions: jsonb("review_suggestions")
      .$type<
        {
          materialId: string
          title: string
          type: string
          href: string
          reason: string
          missedQuestionCount: number
        }[]
      >()
      .default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("quiz_attempts_user_quiz_idx").on(t.userId, t.quizId),
    index("quiz_attempts_completed_at_idx").on(t.completedAt),
  ]
)

export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .references(() => quizAttempts.id, { onDelete: "cascade" })
      .notNull(),
    questionId: uuid("question_id")
      .references(() => questions.id, { onDelete: "cascade" })
      .notNull(),
    selectedOptionId: uuid("selected_option_id")
      .references(() => questionOptions.id, { onDelete: "cascade" })
      .notNull(),
    isCorrect: boolean("is_correct").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("unq_quiz_answer_attempt_question").on(
      t.attemptId,
      t.questionId
    ),
  ]
)

/* ==========================================================================
   4. FLASHCARDS DOMAIN
   ========================================================================== */

export const flashcards = pgTable("flashcards", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekId: uuid("week_id")
    .references(() => courseWeeks.id, { onDelete: "cascade" })
    .notNull(),
  frontContent: text("front_content").notNull(),
  backContent: text("back_content").notNull(),
  sourceFileId: uuid("source_file_id").references(() => files.id, {
    onDelete: "set null",
  }),
  origin: generationOriginEnum("origin").default("MANUAL").notNull(),
  status: contentStatusEnum("status").default("DRAFT").notNull(),
  difficulty: difficultyEnum("difficulty").default("medium").notNull(),
  sourceChunkIds: jsonb("source_chunk_ids")
    .$type<string[]>()
    .default([])
    .notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/* ==========================================================================
   5. CLUBS DOMAIN
   ========================================================================== */

export const clubs = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  schoolYearId: uuid("school_year_id").references(() => schoolYears.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const clubMembers = pgTable(
  "club_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 50 }).default("MEMBER").notNull(), // LEADER, MEMBER, ADVISOR
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    lastReadMessageId: uuid("last_read_message_id"),
    mutedUntil: timestamp("muted_until"),
  },
  (t) => [
    uniqueIndex("unq_club_user").on(t.clubId, t.userId),
    index("idx_club_members_user").on(t.userId),
  ]
)

export const clubMaterials = pgTable("club_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id")
    .references(() => clubs.id, { onDelete: "cascade" })
    .notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // PDF, LINK, DOCUMENT, VIDEO, IMAGE
  contentUrl: text("content_url"),
  fileSize: integer("file_size"),
  orderIndex: integer("order_index").default(0).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const clubMessages = pgTable(
  "club_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clubId: uuid("club_id")
      .references(() => clubs.id, { onDelete: "cascade" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    attachments: jsonb("attachments")
      .$type<
        Array<{ path: string; name: string; mimeType: string; size: number }>
      >()
      .default([])
      .notNull(),
    mentionedUserIds: jsonb("mentioned_user_ids")
      .$type<string[]>()
      .default([])
      .notNull(),
    replyToId: uuid("reply_to_id"),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_club_messages_club_created_at").on(t.clubId, t.createdAt),
    index("idx_club_messages_reply_to").on(t.replyToId),
  ]
)

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    size: integer("size").notNull(),
    path: text("path").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    subjectId: uuid("subject_id").references(() => courses.id, {
      onDelete: "set null",
    }),
    weekNumber: integer("week_number"),
    clubId: uuid("club_id").references(() => clubs.id, {
      onDelete: "set null",
    }),
    learningHubGroupId: uuid("learning_hub_group_id").references(
      () => learningHubGroups.id,
      { onDelete: "set null" }
    ),
    status: fileStatusEnum("status").default("UPLOADED").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_files_subject_week").on(t.subjectId, t.weekNumber),
    index("idx_files_club").on(t.clubId),
    index("idx_files_learning_hub_group").on(t.learningHubGroupId),
    index("idx_files_uploaded_by").on(t.uploadedBy),
  ]
)

export const fileChunks = pgTable(
  "file_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id")
      .references(() => files.id, { onDelete: "cascade" })
      .notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    chunkText: text("chunk_text").notNull(),
    embedding: vector("embedding").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("unq_file_chunks_file_index").on(t.fileId, t.chunkIndex),
    index("idx_file_chunks_file").on(t.fileId),
  ]
)

export const clubMessageReactions = pgTable(
  "club_message_reactions",
  {
    messageId: uuid("message_id")
      .references(() => clubMessages.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    emoji: varchar("emoji", { length: 32 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.userId, t.emoji] }),
    index("idx_club_message_reactions_message").on(t.messageId),
  ]
)

export const clubMessageReads = pgTable(
  "club_message_reads",
  {
    messageId: uuid("message_id")
      .references(() => clubMessages.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    readAt: timestamp("read_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.userId] }),
    index("idx_club_message_reads_user").on(t.userId),
  ]
)

export const chatbots = pgTable("chatbots", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectId: uuid("subject_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .notNull(),
  systemPrompt: text("system_prompt").notNull(),
  model: varchar("model", { length: 64 }).default("gemini-3.5-flash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const chatbotConversations = pgTable(
  "chatbot_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    chatbotId: uuid("chatbot_id")
      .references(() => chatbots.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("idx_chatbot_conversations_user").on(t.userId, t.updatedAt)]
)

export const chatbotMessages = pgTable(
  "chatbot_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => chatbotConversations.id, { onDelete: "cascade" })
      .notNull(),
    role: chatbotRoleEnum("role").notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations")
      .$type<Array<{ chunkId: string; fileId: string; quote?: string }>>()
      .default([])
      .notNull(),
    tokenUsage: jsonb("token_usage")
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_chatbot_messages_conv_created").on(
      t.conversationId,
      t.createdAt
    ),
  ]
)

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    quizId: uuid("quiz_id")
      .references(() => quizzes.id, { onDelete: "cascade" })
      .notNull(),
    type: quizQuestionTypeEnum("type").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().default([]).notNull(),
    answer: jsonb("answer").$type<string | string[] | boolean>().notNull(),
    explanation: text("explanation"),
    difficulty: difficultyEnum("difficulty").default("medium").notNull(),
    sourceChunkIds: jsonb("source_chunk_ids")
      .$type<string[]>()
      .default([])
      .notNull(),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("unq_quiz_questions_fingerprint").on(t.quizId, t.fingerprint),
    index("idx_quiz_questions_quiz").on(t.quizId),
  ]
)

/* ==========================================================================
   6. ACADEMIC STRUCTURE DOMAIN
   school_years → semesters (2 per year)
   school_years → study_programs
   students enroll into one study_program per school_year
   courses reference a school_year, study_program, and semester
   ========================================================================== */

export const schoolYears = pgTable("school_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 20 }).notNull(), // e.g. "2025-2026"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// Two semester rows per school year (FIRST + SECOND)
// midDate marks the exam-period boundary inside the semester
export const semesters = pgTable(
  "semesters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolYearId: uuid("school_year_id")
      .references(() => schoolYears.id, { onDelete: "cascade" })
      .notNull(),
    type: semesterEnum("type").notNull(), // FIRST | SECOND
    startDate: date("start_date").notNull(),
    midDate: date("mid_date").notNull(), // midterm boundary
    endDate: date("end_date").notNull(),
  },
  (t) => [uniqueIndex("unq_year_semester").on(t.schoolYearId, t.type)]
)

export const studyPrograms = pgTable("study_programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(), // e.g. "Informatics"
  code: varchar("code", { length: 20 }), // e.g. "INFO"
  description: text("description"),
  schoolYearId: uuid("school_year_id")
    .references(() => schoolYears.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

// One program enrollment per student per school year (enforced by unique index)
export const studentProgramEnrollments = pgTable(
  "student_program_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    studyProgramId: uuid("study_program_id")
      .references(() => studyPrograms.id, { onDelete: "cascade" })
      .notNull(),
    schoolYearId: uuid("school_year_id")
      .references(() => schoolYears.id, { onDelete: "cascade" })
      .notNull(),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("unq_student_year").on(t.studentId, t.schoolYearId)]
)

// Optional: explicit per-course enrollments (students enrolled in specific courses)
export const courseEnrollments = pgTable(
  "course_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("unq_student_course").on(t.studentId, t.courseId)]
)

/* ==========================================================================
   6b. STUDENT GROUPS & SUBJECT ASSIGNMENTS
   Enhanced academic structure for scheduling
   ========================================================================== */

export const studentGroups = pgTable("student_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  studyProgramId: uuid("study_program_id")
    .references(() => studyPrograms.id, { onDelete: "cascade" })
    .notNull(),
  yearLevel: integer("year_level").notNull().default(1),
  capacity: integer("capacity").default(30),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const studentGroupMembers = pgTable(
  "student_group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .references(() => studentGroups.id, { onDelete: "cascade" })
      .notNull(),
    studentId: uuid("student_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("unq_group_student").on(t.groupId, t.studentId)]
)

export const subjectAssignments = pgTable(
  "subject_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professorId: uuid("professor_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    courseId: uuid("course_id")
      .references(() => courses.id, { onDelete: "cascade" })
      .notNull(),
    groupId: uuid("group_id")
      .references(() => studentGroups.id, { onDelete: "cascade" })
      .notNull(),
    requiredHours: integer("required_hours").notNull().default(2),
    sessionType: sessionTypeEnum("session_type").notNull().default("lecture"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("unq_professor_course_group").on(
      t.professorId,
      t.courseId,
      t.groupId
    ),
  ]
)

/* ==========================================================================
   7. LECTURE MATERIALS DOMAIN
   Weekly content: lectures, PDFs, videos, links, attachments
   ========================================================================== */

export const lectureMaterials = pgTable("lecture_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekId: uuid("week_id")
    .references(() => courseWeeks.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: varchar("type", { length: 50 }).notNull(), // VIDEO, PDF, LINK, DOCUMENT, PRESENTATION
  contentUrl: text("content_url"), // URL to file or external link
  fileSize: integer("file_size"), // in bytes
  duration: integer("duration"), // in seconds (for videos)
  orderIndex: integer("order_index").default(0).notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/* ==========================================================================
   8. ASSIGNMENTS & SUBMISSIONS DOMAIN
   ========================================================================== */

export const assignmentTypeEnum = pgEnum("assignment_type", [
  "essay",
  "project",
  "homework",
  "lab_report",
  "presentation",
])

export const assignmentOriginEnum = pgEnum("assignment_origin", [
  "manual",
  "ai_generated",
])

export const assignmentSubmissionTypeEnum = pgEnum(
  "assignment_submission_type",
  ["text", "file", "both"]
)

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  weekId: uuid("week_id")
    .references(() => courseWeeks.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: assignmentTypeEnum("type").notNull().default("homework"),
  origin: assignmentOriginEnum("origin").notNull().default("manual"),
  sourceFileId: uuid("source_file_id").references(() => files.id, {
    onDelete: "set null",
  }),
  submissionType: assignmentSubmissionTypeEnum("submission_type")
    .notNull()
    .default("both"),
  maxScore: integer("max_score").notNull().default(100),
  dueDate: timestamp("due_date", { mode: "date" }),
  timeLimitMinutes: integer("time_limit_minutes"), // For timed assignments
  isPublished: boolean("is_published").default(false).notNull(),
  allowLateSubmissions: boolean("allow_late_submissions")
    .default(true)
    .notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id, { onDelete: "set null" })
    .notNull(),
  rubric: jsonb("rubric").$type<{
    criteria: { name: string; description: string; points: number }[]
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  weekId: uuid("week_id")
    .references(() => courseWeeks.id, { onDelete: "cascade" })
    .notNull(),
  type: varchar("type", { length: 50 }).notNull(), // quiz, assignment
  referenceId: uuid("reference_id").notNull(), // quizId or assignmentId
  content: text("content"), // Text submission or answers JSON
  fileUrl: text("file_url"), // For file submissions
  score: integer("score"), // Points earned
  maxScore: integer("max_score").notNull(), // Maximum possible points
  feedback: text("feedback"), // Instructor feedback
  status: varchar("status", { length: 50 }).default("submitted").notNull(), // submitted, graded, late
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  gradedAt: timestamp("graded_at"),
  gradedBy: uuid("graded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/* ==========================================================================
   9. ANNOUNCEMENTS & NOTIFICATIONS DOMAIN
   ========================================================================== */

export const announcementScopeEnum = pgEnum("announcement_scope", [
  "global", // All users
  "school_year", // Specific academic year
  "program", // Specific study program
  "course", // Specific course
  "club", // Specific club
])

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  scope: announcementScopeEnum("scope").notNull(),
  // Reference ID based on scope (schoolYearId, programId, courseId, clubId)
  referenceId: uuid("reference_id"),
  authorId: uuid("author_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const notificationTypeEnum = pgEnum("notification_type", [
  "grade",
  "assignment_due",
  "announcement",
  "general",
])

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    type: notificationTypeEnum("type").notNull().default("general"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_notifications_user").on(t.userId),
    index("idx_notifications_user_unread").on(t.userId, t.readAt),
  ]
)

/* ==========================================================================
   10. CLUB POSTS DOMAIN
   ========================================================================== */

export const clubPosts = pgTable("club_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id")
    .references(() => clubs.id, { onDelete: "cascade" })
    .notNull(),
  authorId: uuid("author_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const clubEvents = pgTable("club_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubId: uuid("club_id")
    .references(() => clubs.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/* ==========================================================================
   6. STUDENT LEARNING HUB DOMAIN
   Personal, student-owned study space for goals, notes, tasks, and resources
   ========================================================================== */

export const learningHubItemTypeEnum = pgEnum("learning_hub_item_type", [
  "goal",
  "note",
  "task",
  "resource",
])

export const learningHubs = pgTable(
  "learning_hubs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").default("My Learning Hub").notNull(),
    description: text("description"),
    focus: text("focus"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("unq_learning_hubs_student").on(t.studentId)]
)

export const learningHubItems = pgTable(
  "learning_hub_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hubId: uuid("hub_id")
      .references(() => learningHubs.id, { onDelete: "cascade" })
      .notNull(),
    type: learningHubItemTypeEnum("type").default("note").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    dueAt: timestamp("due_at"),
    isCompleted: boolean("is_completed").default(false).notNull(),
    orderIndex: integer("order_index").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_learning_hub_items_hub").on(t.hubId),
    index("idx_learning_hub_items_created_at").on(t.createdAt),
  ]
)

export const learningHubGroups = pgTable(
  "learning_hub_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hubId: uuid("hub_id")
      .references(() => learningHubs.id, { onDelete: "cascade" })
      .notNull(),
    createdById: uuid("created_by_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    description: text("description"),
    joinCode: varchar("join_code", { length: 12 }).notNull(),
    isDiscoverable: boolean("is_discoverable").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("unq_learning_hub_groups_join_code").on(t.joinCode),
    index("idx_learning_hub_groups_hub").on(t.hubId),
    index("idx_learning_hub_groups_creator").on(t.createdById),
  ]
)

export const learningHubGroupMembers = pgTable(
  "learning_hub_group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .references(() => learningHubGroups.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 24 }).default("MEMBER").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("unq_learning_hub_group_member").on(t.groupId, t.userId),
    index("idx_learning_hub_group_members_user").on(t.userId),
  ]
)

export const learningHubGroupMessages = pgTable(
  "learning_hub_group_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .references(() => learningHubGroups.id, { onDelete: "cascade" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_learning_hub_group_messages_group_created_at").on(
      t.groupId,
      t.createdAt
    ),
  ]
)

/* ==========================================================================
   11. AI CONFIGURATION DOMAIN
   Global AI provider and model settings for chatbot, embeddings, and generation
   ========================================================================== */

export const aiProviderEnum = pgEnum("ai_provider", [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "groq",
  "xai",
  "cohere",
  "deepseek",
  "fireworks",
  "togetherai",
  "perplexity",
  "local",
  "ollama",
  "lm-studio",
])

export const aiModelTypeEnum = pgEnum("ai_model_type", ["text", "embedding"])

export const aiProviderStatusEnum = pgEnum("ai_provider_status", [
  "enabled",
  "disabled",
])

export const aiProviders = pgTable("ai_providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: aiProviderStatusEnum("status").default("enabled").notNull(),
  local: boolean("local").default(false).notNull(),
})

export const aiModels = pgTable(
  "ai_models",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    providerId: text("provider_id")
      .references(() => aiProviders.id, { onDelete: "cascade" })
      .notNull(),
    modelName: text("model_name").notNull(),
    modelIdentifier: text("model_identifier").notNull(),
    modelType: aiModelTypeEnum("model_type").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("unq_ai_models_provider_identifier").on(
      t.providerId,
      t.modelIdentifier
    ),
    index("idx_ai_models_provider").on(t.providerId),
    index("idx_ai_models_type").on(t.modelType),
  ]
)

export const aiSettings = pgTable("ai_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Chat Model Configuration
  chatProvider: aiProviderEnum("chat_provider").default("google").notNull(),
  chatModelId: varchar("chat_model_id", { length: 128 })
    .default("gemini-2.0-flash-001")
    .notNull(),
  chatApiKey: text("chat_api_key"),
  chatBaseUrl: text("chat_base_url"), // For local/custom endpoints
  chatTemperature: varchar("chat_temperature", { length: 10 }).default("0.7"),
  chatMaxTokens: integer("chat_max_tokens").default(4096),
  // Embedding Model Configuration
  embeddingProvider: aiProviderEnum("embedding_provider")
    .default("google")
    .notNull(),
  embeddingModelId: varchar("embedding_model_id", { length: 128 })
    .default("gemini-embedding-001")
    .notNull(),
  embeddingApiKey: text("embedding_api_key"),
  embeddingBaseUrl: text("embedding_base_url"), // For local/custom endpoints
  embeddingDimensions: integer("embedding_dimensions").default(1024),
  // Feature Flags
  isEnabled: boolean("is_enabled").default(true).notNull(),
  allowFileUploads: boolean("allow_file_uploads").default(true).notNull(),
  // Audit
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
})

/* ==========================================================================
   11b. AI SEMANTIC CACHE
   Cached AI responses with vector similarity search
   ========================================================================== */

export const aiResponseCache = pgTable(
  "ai_response_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    question: text("question").notNull(),
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
    response: text("response").notNull(),
    contextHash: text("context_hash").notNull(),
    hitCount: integer("hit_count").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    userRole: text("user_role"), // ADMIN, PROFESSOR, STUDENT or NULL for universal
  },
  (t) => [
    index("idx_ai_cache_embedding").on(t.embedding),
    index("idx_ai_cache_expires").on(t.expiresAt),
    index("idx_ai_cache_context").on(t.contextHash),
    index("idx_ai_cache_user_role").on(t.userRole),
  ]
)

/* ==========================================================================
   11c. SCHEDULE VALIDATIONS
   Audit history of schedule validation runs
   ========================================================================== */

export const scheduleValidations = pgTable("schedule_validations", {
  id: uuid("id").primaryKey().defaultRandom(),
  academicYearId: uuid("academic_year_id")
    .references(() => schoolYears.id, { onDelete: "cascade" })
    .notNull(),
  validatedAt: timestamp("validated_at").defaultNow().notNull(),
  isValid: boolean("is_valid").notNull(),
  conflicts: jsonb("conflicts").default([]).notNull(),
  conflictCount: integer("conflict_count").default(0).notNull(),
  generatedBy: uuid("generated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  generationMode: text("generation_mode").default("manual"), // manual, random, optimized
  validationDurationMs: integer("validation_duration_ms"),
  metadata: jsonb("metadata").default({}),
})

/* ==========================================================================
   RELATIONS
   ========================================================================== */

export const usersRelations = relations(users, ({ one, many }) => ({
  auth: one(userAuth, {
    fields: [users.id],
    references: [userAuth.userId],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
  taughtCourses: many(courses, { relationName: "courseTeacher" }),
  courseEnrollments: many(courseEnrollments),
  programEnrollments: many(studentProgramEnrollments),
  clubMemberships: many(clubMembers),
  clubMaterials: many(clubMaterials),
  clubMessages: many(clubMessages),
  clubPosts: many(clubPosts),
  createdClubEvents: many(clubEvents),
  announcements: many(announcements),
  submissions: many(submissions, { relationName: "studentSubmissions" }),
  gradedSubmissions: many(submissions, { relationName: "gradedSubmissions" }),
  quizAttempts: many(quizAttempts),
  uploadedFiles: many(files),
  clubMessageReactions: many(clubMessageReactions),
  clubMessageReads: many(clubMessageReads),
  chatbotConversations: many(chatbotConversations),
  // New academic structure relations
  subjectAssignments: many(subjectAssignments),
  studentGroupMemberships: many(studentGroupMembers),
  scheduleValidations: many(scheduleValidations),
  notifications: many(notifications),
}))

export const userAuthRelations = relations(userAuth, ({ one }) => ({
  user: one(users, {
    fields: [userAuth.userId],
    references: [users.id],
  }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const coursesRelations = relations(courses, ({ one, many }) => ({
  teacher: one(users, {
    fields: [courses.teacherId],
    references: [users.id],
    relationName: "courseTeacher",
  }),
  schoolYear: one(schoolYears, {
    fields: [courses.schoolYearId],
    references: [schoolYears.id],
  }),
  studyProgram: one(studyPrograms, {
    fields: [courses.studyProgramId],
    references: [studyPrograms.id],
  }),
  weeks: many(courseWeeks),
  enrollments: many(courseEnrollments),
  files: many(files),
  chatbots: many(chatbots),
  schedules: many(courseSchedules),
  subjectAssignments: many(subjectAssignments),
}))

export const courseWeeksRelations = relations(courseWeeks, ({ one, many }) => ({
  course: one(courses, {
    fields: [courseWeeks.courseId],
    references: [courses.id],
  }),
  materials: many(lectureMaterials),
  quizzes: many(quizzes),
  flashcards: many(flashcards),
  assignments: many(assignments),
  submissions: many(submissions),
}))

export const courseSchedulesRelations = relations(
  courseSchedules,
  ({ one }) => ({
    course: one(courses, {
      fields: [courseSchedules.courseId],
      references: [courses.id],
    }),
    group: one(studentGroups, {
      fields: [courseSchedules.groupId],
      references: [studentGroups.id],
    }),
    subjectAssignment: one(subjectAssignments, {
      fields: [courseSchedules.subjectAssignmentId],
      references: [subjectAssignments.id],
    }),
    academicYear: one(schoolYears, {
      fields: [courseSchedules.academicYearId],
      references: [schoolYears.id],
    }),
  })
)

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  week: one(courseWeeks, {
    fields: [quizzes.weekId],
    references: [courseWeeks.id],
  }),
  sourceFile: one(files, {
    fields: [quizzes.sourceFileId],
    references: [files.id],
  }),
  questions: many(questions),
  aiQuestions: many(quizQuestions),
  attempts: many(quizAttempts),
}))

export const questionsRelations = relations(questions, ({ one, many }) => ({
  quiz: one(quizzes, {
    fields: [questions.quizId],
    references: [quizzes.id],
  }),
  options: many(questionOptions),
}))

export const questionOptionsRelations = relations(
  questionOptions,
  ({ one }) => ({
    question: one(questions, {
      fields: [questionOptions.questionId],
      references: [questions.id],
    }),
  })
)

export const quizAttemptsRelations = relations(
  quizAttempts,
  ({ one, many }) => ({
    user: one(users, {
      fields: [quizAttempts.userId],
      references: [users.id],
    }),
    quiz: one(quizzes, {
      fields: [quizAttempts.quizId],
      references: [quizzes.id],
    }),
    answers: many(quizAnswers),
  })
)

export const quizAnswersRelations = relations(quizAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [quizAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(questions, {
    fields: [quizAnswers.questionId],
    references: [questions.id],
  }),
  selectedOption: one(questionOptions, {
    fields: [quizAnswers.selectedOptionId],
    references: [questionOptions.id],
  }),
}))

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  week: one(courseWeeks, {
    fields: [flashcards.weekId],
    references: [courseWeeks.id],
  }),
  sourceFile: one(files, {
    fields: [flashcards.sourceFileId],
    references: [files.id],
  }),
}))

export const schoolYearsRelations = relations(schoolYears, ({ many }) => ({
  semesters: many(semesters),
  studyPrograms: many(studyPrograms),
  studentProgramEnrollments: many(studentProgramEnrollments),
  courses: many(courses),
  clubs: many(clubs),
  scheduleValidations: many(scheduleValidations),
}))

export const semestersRelations = relations(semesters, ({ one }) => ({
  schoolYear: one(schoolYears, {
    fields: [semesters.schoolYearId],
    references: [schoolYears.id],
  }),
}))

export const studyProgramsRelations = relations(
  studyPrograms,
  ({ one, many }) => ({
    schoolYear: one(schoolYears, {
      fields: [studyPrograms.schoolYearId],
      references: [schoolYears.id],
    }),
    studentProgramEnrollments: many(studentProgramEnrollments),
    courses: many(courses),
    studentGroups: many(studentGroups),
  })
)

export const studentProgramEnrollmentsRelations = relations(
  studentProgramEnrollments,
  ({ one }) => ({
    student: one(users, {
      fields: [studentProgramEnrollments.studentId],
      references: [users.id],
    }),
    studyProgram: one(studyPrograms, {
      fields: [studentProgramEnrollments.studyProgramId],
      references: [studyPrograms.id],
    }),
    schoolYear: one(schoolYears, {
      fields: [studentProgramEnrollments.schoolYearId],
      references: [schoolYears.id],
    }),
  })
)

export const courseEnrollmentsRelations = relations(
  courseEnrollments,
  ({ one }) => ({
    student: one(users, {
      fields: [courseEnrollments.studentId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [courseEnrollments.courseId],
      references: [courses.id],
    }),
  })
)

export const lectureMaterialsRelations = relations(
  lectureMaterials,
  ({ one }) => ({
    week: one(courseWeeks, {
      fields: [lectureMaterials.weekId],
      references: [courseWeeks.id],
    }),
  })
)

export const submissionsRelations = relations(submissions, ({ one }) => ({
  student: one(users, {
    fields: [submissions.studentId],
    references: [users.id],
    relationName: "studentSubmissions",
  }),
  week: one(courseWeeks, {
    fields: [submissions.weekId],
    references: [courseWeeks.id],
  }),
  grader: one(users, {
    fields: [submissions.gradedBy],
    references: [users.id],
    relationName: "gradedSubmissions",
  }),
}))

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  week: one(courseWeeks, {
    fields: [assignments.weekId],
    references: [courseWeeks.id],
  }),
  sourceFile: one(files, {
    fields: [assignments.sourceFileId],
    references: [files.id],
  }),
  creator: one(users, {
    fields: [assignments.createdBy],
    references: [users.id],
  }),
}))

export const announcementsRelations = relations(announcements, ({ one }) => ({
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
}))

export const clubsRelations = relations(clubs, ({ one, many }) => ({
  schoolYear: one(schoolYears, {
    fields: [clubs.schoolYearId],
    references: [schoolYears.id],
  }),
  members: many(clubMembers),
  materials: many(clubMaterials),
  messages: many(clubMessages),
  files: many(files),
  posts: many(clubPosts),
  events: many(clubEvents),
}))

export const clubMembersRelations = relations(clubMembers, ({ one }) => ({
  club: one(clubs, {
    fields: [clubMembers.clubId],
    references: [clubs.id],
  }),
  user: one(users, {
    fields: [clubMembers.userId],
    references: [users.id],
  }),
}))

export const clubMaterialsRelations = relations(clubMaterials, ({ one }) => ({
  club: one(clubs, {
    fields: [clubMaterials.clubId],
    references: [clubs.id],
  }),
  uploader: one(users, {
    fields: [clubMaterials.uploadedBy],
    references: [users.id],
  }),
}))

export const clubMessagesRelations = relations(
  clubMessages,
  ({ one, many }) => ({
    club: one(clubs, {
      fields: [clubMessages.clubId],
      references: [clubs.id],
    }),
    author: one(users, {
      fields: [clubMessages.authorId],
      references: [users.id],
    }),
    replyTo: one(clubMessages, {
      fields: [clubMessages.replyToId],
      references: [clubMessages.id],
      relationName: "clubMessageReply",
    }),
    reactions: many(clubMessageReactions),
    reads: many(clubMessageReads),
  })
)

export const filesRelations = relations(files, ({ one, many }) => ({
  uploader: one(users, {
    fields: [files.uploadedBy],
    references: [users.id],
  }),
  subject: one(courses, {
    fields: [files.subjectId],
    references: [courses.id],
  }),
  club: one(clubs, {
    fields: [files.clubId],
    references: [clubs.id],
  }),
  learningHubGroup: one(learningHubGroups, {
    fields: [files.learningHubGroupId],
    references: [learningHubGroups.id],
  }),
  chunks: many(fileChunks),
  quizzes: many(quizzes),
  flashcards: many(flashcards),
}))

export const fileChunksRelations = relations(fileChunks, ({ one }) => ({
  file: one(files, {
    fields: [fileChunks.fileId],
    references: [files.id],
  }),
}))

export const clubMessageReactionsRelations = relations(
  clubMessageReactions,
  ({ one }) => ({
    message: one(clubMessages, {
      fields: [clubMessageReactions.messageId],
      references: [clubMessages.id],
    }),
    user: one(users, {
      fields: [clubMessageReactions.userId],
      references: [users.id],
    }),
  })
)

export const clubMessageReadsRelations = relations(
  clubMessageReads,
  ({ one }) => ({
    message: one(clubMessages, {
      fields: [clubMessageReads.messageId],
      references: [clubMessages.id],
    }),
    user: one(users, {
      fields: [clubMessageReads.userId],
      references: [users.id],
    }),
  })
)

export const chatbotsRelations = relations(chatbots, ({ one, many }) => ({
  subject: one(courses, {
    fields: [chatbots.subjectId],
    references: [courses.id],
  }),
  conversations: many(chatbotConversations),
}))

export const chatbotConversationsRelations = relations(
  chatbotConversations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [chatbotConversations.userId],
      references: [users.id],
    }),
    chatbot: one(chatbots, {
      fields: [chatbotConversations.chatbotId],
      references: [chatbots.id],
    }),
    messages: many(chatbotMessages),
  })
)

export const chatbotMessagesRelations = relations(
  chatbotMessages,
  ({ one }) => ({
    conversation: one(chatbotConversations, {
      fields: [chatbotMessages.conversationId],
      references: [chatbotConversations.id],
    }),
  })
)

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizQuestions.quizId],
    references: [quizzes.id],
  }),
}))

export const clubPostsRelations = relations(clubPosts, ({ one }) => ({
  club: one(clubs, {
    fields: [clubPosts.clubId],
    references: [clubs.id],
  }),
  author: one(users, {
    fields: [clubPosts.authorId],
    references: [users.id],
  }),
}))

export const clubEventsRelations = relations(clubEvents, ({ one }) => ({
  club: one(clubs, {
    fields: [clubEvents.clubId],
    references: [clubs.id],
  }),
  creator: one(users, {
    fields: [clubEvents.createdBy],
    references: [users.id],
  }),
}))

export const learningHubsRelations = relations(
  learningHubs,
  ({ one, many }) => ({
    student: one(users, {
      fields: [learningHubs.studentId],
      references: [users.id],
    }),
    items: many(learningHubItems),
    groups: many(learningHubGroups),
  })
)

export const learningHubGroupsRelations = relations(
  learningHubGroups,
  ({ one, many }) => ({
    hub: one(learningHubs, {
      fields: [learningHubGroups.hubId],
      references: [learningHubs.id],
    }),
    creator: one(users, {
      fields: [learningHubGroups.createdById],
      references: [users.id],
    }),
    members: many(learningHubGroupMembers),
    messages: many(learningHubGroupMessages),
    files: many(files),
  })
)

export const learningHubGroupMembersRelations = relations(
  learningHubGroupMembers,
  ({ one }) => ({
    group: one(learningHubGroups, {
      fields: [learningHubGroupMembers.groupId],
      references: [learningHubGroups.id],
    }),
    user: one(users, {
      fields: [learningHubGroupMembers.userId],
      references: [users.id],
    }),
  })
)

export const learningHubGroupMessagesRelations = relations(
  learningHubGroupMessages,
  ({ one }) => ({
    group: one(learningHubGroups, {
      fields: [learningHubGroupMessages.groupId],
      references: [learningHubGroups.id],
    }),
    author: one(users, {
      fields: [learningHubGroupMessages.authorId],
      references: [users.id],
    }),
  })
)

export const learningHubItemsRelations = relations(
  learningHubItems,
  ({ one }) => ({
    hub: one(learningHubs, {
      fields: [learningHubItems.hubId],
      references: [learningHubs.id],
    }),
  })
)

export const aiSettingsRelations = relations(aiSettings, ({ one }) => ({
  updater: one(users, {
    fields: [aiSettings.updatedBy],
    references: [users.id],
  }),
}))

export const aiProvidersRelations = relations(aiProviders, ({ many }) => ({
  models: many(aiModels),
}))

export const aiModelsRelations = relations(aiModels, ({ one }) => ({
  provider: one(aiProviders, {
    fields: [aiModels.providerId],
    references: [aiProviders.id],
  }),
}))

/* ==========================================================================
   NEW ACADEMIC STRUCTURE RELATIONS
   ========================================================================== */

export const studentGroupsRelations = relations(
  studentGroups,
  ({ one, many }) => ({
    studyProgram: one(studyPrograms, {
      fields: [studentGroups.studyProgramId],
      references: [studyPrograms.id],
    }),
    members: many(studentGroupMembers),
    subjectAssignments: many(subjectAssignments),
  })
)

export const studentGroupMembersRelations = relations(
  studentGroupMembers,
  ({ one }) => ({
    group: one(studentGroups, {
      fields: [studentGroupMembers.groupId],
      references: [studentGroups.id],
    }),
    student: one(users, {
      fields: [studentGroupMembers.studentId],
      references: [users.id],
    }),
  })
)

export const subjectAssignmentsRelations = relations(
  subjectAssignments,
  ({ one, many }) => ({
    professor: one(users, {
      fields: [subjectAssignments.professorId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [subjectAssignments.courseId],
      references: [courses.id],
    }),
    group: one(studentGroups, {
      fields: [subjectAssignments.groupId],
      references: [studentGroups.id],
    }),
    schedules: many(courseSchedules),
  })
)

export const aiResponseCacheRelations = relations(aiResponseCache, () => ({
  // No relations - standalone cache table
}))

export const scheduleValidationsRelations = relations(
  scheduleValidations,
  ({ one }) => ({
    academicYear: one(schoolYears, {
      fields: [scheduleValidations.academicYearId],
      references: [schoolYears.id],
    }),
    generator: one(users, {
      fields: [scheduleValidations.generatedBy],
      references: [users.id],
    }),
  })
)
