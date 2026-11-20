package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"optimolms/backend/internal/config"
	"optimolms/backend/internal/db"
	"optimolms/backend/internal/handler"
)

func main() {
	cfg := config.Load()

	database, err := db.Open(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer database.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := db.Migrate(ctx, database); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	log.Printf("migrations applied (db: %s)", cfg.DatabasePath)

	if err := db.Seed(ctx, database); err != nil {
		log.Fatalf("seed: %v", err)
	}
	log.Println("seed ok")

	mux := http.NewServeMux()
	// Register returns the whole chain: the routes behind session resolution and
	// the permission policy, so no route can be served without a caller.
	app := handler.Register(mux, database, cfg)

	addr := ":" + cfg.Port
	log.Printf("backend listening on %s", addr)
	if err := http.ListenAndServe(addr, cors(app)); err != nil {
		log.Fatal(err)
	}
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
