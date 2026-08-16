// Package logging provides a shared structured logger for the gateway.
package logging

import (
	"log/slog"
	"os"
)

// New returns a JSON structured logger writing to stdout.
func New(serviceName string) *slog.Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	return slog.New(handler).With("service", serviceName)
}
