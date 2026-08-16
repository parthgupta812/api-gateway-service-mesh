// Command user-service is a mock backend service for users.
package main

import "apigateway/internal/mockservice"

func main() {
	mockservice.Run(mockservice.Config{
		Name:         "user-service",
		Port:         "9001",
		ResourcePath: "/users",
		Items:        []string{"alice", "bob", "carol"},
	})
}
