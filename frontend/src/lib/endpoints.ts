/**
 * Static catalog of gateway endpoints, grouped by service. Routes and
 * methods here reflect the actual gateway implementation
 * (internal/router/router.go) — this list does not change gateway
 * behavior, it only describes it for the Endpoints page and Playground.
 */
export type EndpointDef = {
  method: string
  path: string
  group: 'Users' | 'Orders' | 'Products' | 'System'
  upstream: string | null
  description: string
  /** Prometheus route label this corresponds to, for live stats lookup. */
  routeLabel: string | null
}

export const ENDPOINTS: EndpointDef[] = [
  { method: 'GET', path: '/api/users', group: 'Users', upstream: 'user-service', description: 'List users', routeLabel: '/api/users' },
  { method: 'GET', path: '/api/users/1', group: 'Users', upstream: 'user-service', description: 'Get user by ID (load balanced N/A, single instance)', routeLabel: '/api/users/*proxyPath' },
  { method: 'GET', path: '/api/orders', group: 'Orders', upstream: 'order-service-1/2/3', description: 'List orders (round-robin across 3 instances)', routeLabel: '/api/orders' },
  { method: 'GET', path: '/api/orders/1', group: 'Orders', upstream: 'order-service-1/2/3', description: 'Get order by ID', routeLabel: '/api/orders/*proxyPath' },
  { method: 'GET', path: '/api/products', group: 'Products', upstream: 'product-service', description: 'List products', routeLabel: '/api/products' },
  { method: 'GET', path: '/api/products/1', group: 'Products', upstream: 'product-service', description: 'Get product by ID', routeLabel: '/api/products/*proxyPath' },
  { method: 'GET', path: '/health', group: 'System', upstream: null, description: 'Gateway + Redis health', routeLabel: '/health' },
  { method: 'GET', path: '/metrics', group: 'System', upstream: null, description: 'Prometheus exposition format', routeLabel: '/metrics' },
  { method: 'GET', path: '/gateway/topology', group: 'System', upstream: null, description: 'Live registry & circuit breaker state', routeLabel: '/gateway/topology' },
  { method: 'GET', path: '/gateway/recent-requests', group: 'System', upstream: null, description: 'Recent proxied request log', routeLabel: '/gateway/recent-requests' },
]

export const GROUP_ORDER: EndpointDef['group'][] = ['Users', 'Orders', 'Products', 'System']
