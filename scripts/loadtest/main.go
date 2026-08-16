// Command loadtest is a small, dependency-free HTTP load generator used
// for Milestone 4 QA. It is not part of the gateway build and is not
// imported by any production code.
//
// Usage:
//
//	go run ./scripts/loadtest -url http://localhost:8081/api/products -n 300 -c 50
package main

import (
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"
)

func main() {
	url := flag.String("url", "http://localhost:8081/health", "target URL")
	total := flag.Int("n", 200, "total number of requests")
	concurrency := flag.Int("c", 50, "number of concurrent workers")
	flag.Parse()

	client := &http.Client{Timeout: 10 * time.Second}

	jobs := make(chan int, *total)
	for i := 0; i < *total; i++ {
		jobs <- i
	}
	close(jobs)

	type result struct {
		status   int
		err      bool
		duration time.Duration
	}

	results := make(chan result, *total)
	var wg sync.WaitGroup

	start := time.Now()
	for w := 0; w < *concurrency; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for range jobs {
				reqStart := time.Now()
				resp, err := client.Get(*url)
				dur := time.Since(reqStart)
				if err != nil {
					results <- result{err: true, duration: dur}
					continue
				}
				io.Copy(io.Discard, resp.Body)
				resp.Body.Close()
				results <- result{status: resp.StatusCode, duration: dur}
			}
		}()
	}

	wg.Wait()
	close(results)
	totalDuration := time.Since(start)

	var (
		success, rateLimited, clientErr, serverErr, transportErr int
		durations                                                []time.Duration
	)

	for r := range results {
		if r.err {
			transportErr++
			continue
		}
		durations = append(durations, r.duration)
		switch {
		case r.status == 429:
			rateLimited++
		case r.status >= 200 && r.status < 300:
			success++
		case r.status >= 400 && r.status < 500:
			clientErr++
		case r.status >= 500:
			serverErr++
		}
	}

	sort.Slice(durations, func(i, j int) bool { return durations[i] < durations[j] })

	var avg time.Duration
	var p95 time.Duration
	if len(durations) > 0 {
		var sum time.Duration
		for _, d := range durations {
			sum += d
		}
		avg = sum / time.Duration(len(durations))
		p95Index := int(float64(len(durations)) * 0.95)
		if p95Index >= len(durations) {
			p95Index = len(durations) - 1
		}
		p95 = durations[p95Index]
	}

	fmt.Printf("target: %s\n", *url)
	fmt.Printf("total requests: %d\n", *total)
	fmt.Printf("concurrency: %d\n", *concurrency)
	fmt.Printf("total duration: %s\n", totalDuration)
	fmt.Printf("requests/sec: %.2f\n", float64(*total)/totalDuration.Seconds())
	fmt.Printf("success (2xx): %d\n", success)
	fmt.Printf("rate-limited (429): %d\n", rateLimited)
	fmt.Printf("client errors (4xx excl. 429): %d\n", clientErr)
	fmt.Printf("server errors (5xx): %d\n", serverErr)
	fmt.Printf("transport errors: %d\n", transportErr)
	fmt.Printf("avg latency: %s\n", avg)
	fmt.Printf("p95 latency: %s\n", p95)

	if transportErr > *total/2 {
		os.Exit(1)
	}
}
