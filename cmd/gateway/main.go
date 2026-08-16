// Command gateway runs the API Gateway HTTP server.
package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

	"apigateway/internal/config"
	"apigateway/internal/logging"
	"apigateway/internal/router"
)

func main() {
	cfg := config.Load()
	logger := logging.New("api-gateway")

	redisClient := redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort),
	})
	defer redisClient.Close()

	if err := pingRedisWithRetry(redisClient, logger); err != nil {
		logger.Warn("starting without confirmed redis connectivity", "error", err.Error())
	}

	// healthCtx controls the lifetime of background health-check goroutines
	// started by router.New; cancelling it on shutdown stops them cleanly.
	healthCtx, cancelHealth := context.WithCancel(context.Background())
	defer cancelHealth()

	engine, _, err := router.New(healthCtx, cfg, redisClient, logger)
	if err != nil {
		logger.Error("failed to build router", "error", err.Error())
		os.Exit(1)
	}

	srv := &http.Server{
		Addr:    ":" + cfg.GatewayPort,
		Handler: engine,
	}

	go func() {
		logger.Info("gateway starting", "port", cfg.GatewayPort)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("server error", "error", err.Error())
			os.Exit(1)
		}
	}()

	// Wait for interrupt/terminate signal, then shut down gracefully.
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

	logger.Info("gateway stopped cleanly")
}

// pingRedisWithRetry attempts to connect to Redis a few times at startup so
// the gateway doesn't crash-loop while Redis is still starting up in
// docker-compose.
func pingRedisWithRetry(client *redis.Client, logger interface {
	Info(msg string, args ...any)
	Warn(msg string, args ...any)
}) error {
	var lastErr error
	for i := 0; i < 5; i++ {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		err := client.Ping(ctx).Err()
		cancel()
		if err == nil {
			logger.Info("connected to redis")
			return nil
		}
		lastErr = err
		time.Sleep(2 * time.Second)
	}
	return lastErr
}
