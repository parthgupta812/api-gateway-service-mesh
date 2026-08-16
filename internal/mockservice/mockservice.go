// Package mockservice implements a tiny, generic HTTP service used to
// simulate backend microservices (user/order/product) behind the gateway.
package mockservice

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

// Config describes a mock backend service instance.
type Config struct {
	Name         string   // e.g. "user-service"
	Port         string   // e.g. "9001"
	ResourcePath string   // e.g. "/users"
	Items        []string // sample payload returned by the resource endpoint
}

// Run starts the mock service and blocks until it receives a shutdown
// signal, then shuts down gracefully.
func Run(cfg Config) {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil)).With("service", cfg.Name)

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"status":  "ok",
			"service": cfg.Name,
		})
	})

	mux.HandleFunc(cfg.ResourcePath, func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"service": cfg.Name,
			"path":    r.URL.Path,
			"data":    cfg.Items,
		})
	})

	// Catch-all under the resource path, e.g. /users/123
	mux.HandleFunc(cfg.ResourcePath+"/", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"service": cfg.Name,
			"path":    r.URL.Path,
			"message": "handled by " + cfg.Name,
		})
	})

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: logRequests(logger, mux),
	}

	go func() {
		logger.Info("service starting", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server error", "error", err.Error())
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	logger.Info("shutdown signal received")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("graceful shutdown failed", "error", err.Error())
		os.Exit(1)
	}

	logger.Info("service stopped cleanly")
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func logRequests(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		logger.Info("request handled",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"duration_ms", time.Since(start).Milliseconds(),
		)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}
