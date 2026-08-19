import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Page } from '../components/Page'
import { sendPlaygroundRequest, type PlaygroundResult } from '../lib/gateway'
import { ENDPOINTS } from '../lib/endpoints'
import { IconSend } from '../components/Icons'
import { statusClass } from '../lib/format'

const METHODS = ['GET', 'POST', 'PUT', 'DELETE']

type HeaderRow = { key: string; value: string; id: number }

let rowId = 0
function newRow(key = '', value = ''): HeaderRow {
  return { key, value, id: rowId++ }
}

/**
 * Real request-testing interface. Every "Send Request" click makes an
 * actual fetch() through the gateway's own nginx proxy (/api/gw/*), which
 * is the exact same path a browser would use to reach the live gateway —
 * there is no mock or simulated response path here.
 */
export default function PlaygroundPage() {
  const [params] = useSearchParams()

  const [method, setMethod] = useState(params.get('method') || 'GET')
  const [path, setPath] = useState(params.get('path') || '/api/orders')
  const [headers, setHeaders] = useState<HeaderRow[]>([newRow()])
  const [body, setBody] = useState('{\n  \n}')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<PlaygroundResult | null>(null)
  const [bodyError, setBodyError] = useState<string | null>(null)

  // Re-sync if navigated here again from the Endpoints page with new params.
  useEffect(() => {
    const m = params.get('method')
    const p = params.get('path')
    if (m) setMethod(m)
    if (p) setPath(p)
  }, [params])

  const showBody = method === 'POST' || method === 'PUT'

  const updateHeader = (id: number, field: 'key' | 'value', value: string) => {
    setHeaders((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }
  const addHeaderRow = () => setHeaders((rows) => [...rows, newRow()])
  const removeHeaderRow = (id: number) => setHeaders((rows) => rows.filter((r) => r.id !== id))

  const send = async () => {
    setBodyError(null)

    let bodyToSend: string | null = null
    if (showBody) {
      const trimmed = body.trim()
      if (trimmed.length > 0) {
        try {
          JSON.parse(trimmed)
          bodyToSend = trimmed
        } catch {
          setBodyError('Request body is not valid JSON')
          return
        }
      }
    }

    const headerMap: Record<string, string> = {}
    for (const h of headers) {
      if (h.key.trim()) headerMap[h.key.trim()] = h.value
    }

    setSending(true)
    setResult(null)
    const res = await sendPlaygroundRequest(method, path, headerMap, bodyToSend)
    setResult(res)
    setSending(false)
  }

  return (
    <Page title="API Playground" subtitle="Send and inspect real gateway requests" showRange={false}>
      <div className="grid grid-main">
        <section className="card playground-request">
          <div className="card-head">
            <div className="card-head-left">
              <h2>Request</h2>
            </div>
          </div>

          <div className="pg-url-row">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="pg-method-select" aria-label="HTTP method">
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="pg-path-input mono"
              placeholder="/api/orders"
              aria-label="Request path"
            />
          </div>

          <div className="pg-examples">
            <span className="subtle">Examples:</span>
            {ENDPOINTS.filter((e) => e.group !== 'System' || e.path === '/health').map((e) => (
              <button
                key={`${e.method}-${e.path}`}
                type="button"
                className="pg-example-chip"
                onClick={() => {
                  setMethod(e.method)
                  setPath(e.path)
                }}
              >
                {e.method} {e.path}
              </button>
            ))}
          </div>

          <div className="pg-section">
            <div className="pg-section-head">
              <span>Headers</span>
              <button type="button" className="pg-add-btn" onClick={addHeaderRow}>
                + Add header
              </button>
            </div>
            {headers.map((h) => (
              <div key={h.id} className="pg-header-row">
                <input
                  type="text"
                  value={h.key}
                  onChange={(e) => updateHeader(h.id, 'key', e.target.value)}
                  placeholder="Header-Name"
                  className="mono"
                />
                <input
                  type="text"
                  value={h.value}
                  onChange={(e) => updateHeader(h.id, 'value', e.target.value)}
                  placeholder="value"
                  className="mono"
                />
                <button
                  type="button"
                  className="pg-remove-btn"
                  onClick={() => removeHeaderRow(h.id)}
                  aria-label="Remove header"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {showBody && (
            <div className="pg-section">
              <div className="pg-section-head">
                <span>Request body (JSON)</span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="pg-body-editor mono"
                rows={8}
                spellCheck={false}
              />
              {bodyError && <p className="pg-body-error">{bodyError}</p>}
            </div>
          )}

          <button type="button" className="pg-send-btn" onClick={send} disabled={sending}>
            <IconSend size={15} />
            {sending ? 'Sending…' : 'Send Request'}
          </button>
        </section>

        <section className="card playground-response">
          <div className="card-head">
            <div className="card-head-left">
              <h2>Response</h2>
            </div>
          </div>

          {!result && !sending && <p className="empty-note">Send a request to see the real gateway response here.</p>}
          {sending && <p className="empty-note">Waiting for the gateway…</p>}

          {result && !sending && <ResponseView result={result} />}
        </section>
      </div>
    </Page>
  )
}

function ResponseView({ result }: { result: PlaygroundResult }) {
  if (result.error) {
    return (
      <div className="pg-error">
        <strong>Request failed</strong>
        <p>{result.error}</p>
      </div>
    )
  }

  return (
    <div className="pg-response-body">
      <div className="pg-response-summary">
        <span className={`status-chip status-chip-lg ${statusClass(result.status)}`}>
          {result.status} {result.statusText}
        </span>
        <span className="pg-summary-item">{result.durationMs.toFixed(1)} ms</span>
        {result.upstream && (
          <span className="pg-summary-item">
            upstream: <span className="upstream-chip">{result.upstream.replace(/^https?:\/\//, '').split(':')[0]}</span>
          </span>
        )}
      </div>

      <div className="pg-section">
        <div className="pg-section-head">
          <span>Response headers</span>
        </div>
        <div className="pg-headers-list mono">
          {Object.entries(result.headers).map(([k, v]) => (
            <div key={k} className="pg-header-line">
              <span className="pg-header-key">{k}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pg-section">
        <div className="pg-section-head">
          <span>Body</span>
        </div>
        <pre className="pg-body-view mono">
          {result.bodyJson !== null ? JSON.stringify(result.bodyJson, null, 2) : result.bodyText || '(empty body)'}
        </pre>
      </div>
    </div>
  )
}
