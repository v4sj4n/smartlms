import { db } from "./index"
import { sql } from "drizzle-orm"

async function main() {
  console.log("🔥 Dropping ALL possible tables and types from Supabase...")

  await db.execute(sql`
    DROP TABLE IF EXISTS 
      "lesson_progress", 
      "announcements",
      "club_events",
      "club_posts",
      "club_messages",
      "club_materials",
      "lecture_materials",
      "submissions", 
      "quiz_answers",
      "quiz_attempts",
      "assignments", 
      "flashcards", 
      "flashcard_decks", 
      "lessons", 
      "course_modules", 
      "course_weeks",
      "quizzes",
      "questions",
      "question_options",
      "course_enrollments",
      "student_program_enrollments",
      "study_programs",
      "semesters",
      "school_years",
      "enrollments", 
      "courses", 
      "user_auth", 
      "users", 
      "ai_embeddings", 
      "club_members", 
      "clubs", 
      "accounts",
      "sessions",
      "__drizzle_migrations" 
    CASCADE;
  `)

  await db.execute(sql`
    DROP TYPE IF EXISTS 
      "announcement_scope",
      "assignment_type",
      "semester",
      "question_type", 
      "quiz_type", 
      "user_role",
      "content_status",
      "generation_origin",
      "difficulty"
    CASCADE;
  `)

  console.log("✨ Database successfully cleaned! Ready for fresh migrations.")
  process.exit(0)
}

main().catch((err) => {
  console.error("❌ Reset failed:", err)
  process.exit(1)
})
