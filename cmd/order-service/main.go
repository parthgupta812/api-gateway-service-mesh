// Command order-service is a mock backend service for orders.
package main

import "apigateway/internal/mockservice"

func main() {
	mockservice.Run(mockservice.Config{
		Name:         "order-service",
		Port:         "9002",
		ResourcePath: "/orders",
		Items:        []string{"order-1001", "order-1002", "order-1003"},
	})
}
