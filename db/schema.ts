import {
  pgTable,
  uuid,
  text,
  varchar,
  pgEnum,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
  vector,
  index,
} from "drizzle-orm/pg-core"

/* =========================
   USERS + AUTH STRUCTURE
========================= */
export const userRoleEnum = pgEnum("user_role", ["admin", "teacher", "student"])

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  phone: varchar("phone", { length: 256 }),
  role: userRoleEnum("role").notNull().default("student"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const userAuth = pgTable("user_auth", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  passwordHash: text("password_hash").notNull(),
})

/* =========================
   COURSES
========================= */
export const courses = pgTable("courses", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  teacherId: uuid("teacher_id")
    .references(() => users.id, { onDelete: "restrict" })
    .notNull(),
  isPublished: boolean("is_published").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

/* =========================
   ENROLLMENTS (M:N)
========================= */
export const enrollments = pgTable(
  "enrollments",
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
  (t) => [
    // FIX: Switched from object to Array for the new Drizzle signature
    uniqueIndex("unq_student_course").on(t.studentId, t.courseId),
  ]
)

/* =========================
   COURSE MODULES
========================= */
export const courseModules = pgTable("course_modules", {
  id: uuid("id").primaryKey().defaultRandom(),
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "cascade" })
    .notNull(),
  orderIndex: integer("order_index").notNull(),
  title: text("title").notNull(),
  description: text("description"),
})

/* =========================
   LESSONS
========================= */
export const lessons = pgTable("lessons", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleId: uuid("module_id")
    .references(() => courseModules.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  content: text("content"),
  orderIndex: integer("order_index").default(0),
})

/* =========================
   ASSIGNMENTS
========================= */
export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleId: uuid("module_id")
    .references(() => courseModules.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  maxScore: integer("max_score").default(100),
  dueDate: timestamp("due_date"),
})

/* =========================
   SUBMISSIONS
========================= */
export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  assignmentId: uuid("assignment_id")
    .references(() => assignments.id, { onDelete: "cascade" })
    .notNull(),
  studentId: uuid("student_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content"),
  score: integer("score"),
  feedback: text("feedback"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  gradedAt: timestamp("graded_at"),
})

/* =========================
   PROGRESS TRACKING
========================= */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .references(() => lessons.id, { onDelete: "cascade" })
      .notNull(),
    studentId: uuid("student_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    completed: boolean("completed").default(false),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    // FIX: Using array syntax
    uniqueIndex("unq_lesson_student").on(t.lessonId, t.studentId),
  ]
)

/* =========================
   QUIZZES & ASSESSMENTS
========================= */
export const quizTypeEnum = pgEnum("quiz_type", ["graded", "practice"])

export const quizzes = pgTable("quizzes", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleId: uuid("module_id")
    .references(() => courseModules.id, { onDelete: "cascade" }) // FIX: Added missing ref
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: quizTypeEnum("type").default("graded").notNull(),
  timeLimitMinutes: integer("time_limit_minutes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

/* =========================
   QUESTIONS
========================= */
export const questionTypeEnum = pgEnum("question_type", [
  "true_false",
  "single_choice",
  "multiple_select",
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
})

export const questionOptions = pgTable("question_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .references(() => questions.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  isCorrect: boolean("is_correct").default(false).notNull(),
  explanation: text("explanation"),
})

/* =========================
   FLASHCARDS
========================= */
export const flashcardDecks = pgTable("flashcard_decks", {
  id: uuid("id").primaryKey().defaultRandom(),
  moduleId: uuid("module_id")
    .references(() => courseModules.id, { onDelete: "cascade" }) // FIX: Added missing ref
    .notNull(),
  title: text("title").notNull(),
})

export const flashcards = pgTable("flashcards", {
  id: uuid("id").primaryKey().defaultRandom(),
  deckId: uuid("deck_id")
    .references(() => flashcardDecks.id, { onDelete: "cascade" })
    .notNull(),
  frontContent: text("front_content").notNull(),
  backContent: text("back_content").notNull(),
})

/* =========================
   AI VECTOR STORE
========================= */
export const aiEmbeddings = pgTable(
  "ai_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceType: varchar("resource_type", { length: 50 }).notNull(),
    resourceId: uuid("resource_id").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // FIX: Switched to array syntax for HNSW index
    index("embedding_index").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ]
)
