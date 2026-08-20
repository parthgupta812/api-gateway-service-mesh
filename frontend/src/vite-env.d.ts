/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public HTTPS URL of the deployed API Gateway. Unset locally. */
  readonly VITE_GATEWAY_PUBLIC_URL?: string
  /** Public HTTPS URL of the deployed Prometheus instance. Unset locally. */
  readonly VITE_PROMETHEUS_PUBLIC_URL?: string
  /** Public HTTPS URL of a publicly deployed Grafana, if ever added. Unset locally. */
  readonly VITE_GRAFANA_PUBLIC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
