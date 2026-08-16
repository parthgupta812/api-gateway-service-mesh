// Command product-service is a mock backend service for products.
package main

import "apigateway/internal/mockservice"

func main() {
	mockservice.Run(mockservice.Config{
		Name:         "product-service",
		Port:         "9003",
		ResourcePath: "/products",
		Items:        []string{"widget", "gadget", "gizmo"},
	})
}
