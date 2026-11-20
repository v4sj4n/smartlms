package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"optimolms/backend/internal/config"
	"optimolms/backend/internal/keycrypt"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// Register wires every route and returns the handler the server serves: the mux
// behind withSessions, which resolves the caller and enforces the route policy.
// Nothing below needs to re-check who is calling; handlers read the caller from
// the request context (callerFrom).
func Register(mux *http.ServeMux, db *sql.DB, serverConfig config.Config) http.Handler {
	// Provider API keys are encrypted at rest with a secret from the
	// environment (AI_ENCRYPTION_SECRET in internal/config).
	crypt, err := keycrypt.New(serverConfig.EncryptionSecret)
	if err != nil {
		panic(fmt.Sprintf("ai key encryption: %v", err))
	}

	// Two-factor secrets are sealed under their own HKDF label, derived from
	// the same server secret: material for one purpose never opens the other.
	twoFactorCrypt, err := keycrypt.NewLabeled(serverConfig.EncryptionSecret, "user-totp-secret")
	if err != nil {
		panic(fmt.Sprintf("two-factor secret encryption: %v", err))
	}
	twoFactor := &twoFactorService{db: db, crypt: twoFactorCrypt}
	sessions := &sessionStore{db: db}

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "up"
		if err := db.PingContext(r.Context()); err != nil {
			dbStatus = "down"
		}
		writeJSON(w, http.StatusOK, map[string]string{
			"status":  "ok",
			"service": "optimolms-backend",
			"db":      dbStatus,
		})
	})
	registerSession(mux, sessions)
	registerAuth(mux, db, twoFactor, sessions)
	registerMeta(mux, db)
	registerAcademic(mux, db)
	registerSchoolYears(mux, db)
	registerCampuses(mux, db)
	registerRoles(mux, db)
	registerSubjects(mux, db)
	registerSubjectEnrollments(mux, db)
	registerSchedule(mux, db)
	registerLectureFiles(mux, db)
	registerWeeks(mux, db)
	registerAssignments(mux, db)
	registerSubmissionFiles(mux, db)
	registerGeneralSettings(mux, db)
	registerGrades(mux, db)
	registerForums(mux, db)
	registerQuizAttempts(mux, db)
	registerUsers(mux, db)
	registerStudents(mux, db)
	registerTwoFactor(mux, twoFactor, sessions)
	registerNotifications(mux, db)
	registerUserPermissions(mux, db)
	registerAISettings(mux, db)
	registerUserAppearance(mux, db)
	registerUserMcpApps(mux, db)
	registerMCP(mux, db)
	registerAIProviders(mux, db, crypt)
	registerAIProviderSetup(mux, db, crypt)
	registerAIChat(mux, db, crypt)
	registerAISessions(mux, db)

	return withSessions(mux, sessions)
}
