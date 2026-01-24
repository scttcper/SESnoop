import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

type Source = {
  id: number
  name: string
  token: string
  color: string
  retention_days: number | null
  created_at: number
  updated_at: number
}

type SetupInfo = {
  source: Source
  configuration_set_name: string
  sns_topic_name: string
  webhook_url: string
  steps: string[]
}

const COLORS = ['purple', 'blue', 'cyan', 'green', 'red', 'orange', 'yellow', 'gray']

const formatDate = (value?: number | null) => {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleDateString()
}

export default function App() {
  const [sources, setSources] = useState<Source[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [panel, setPanel] = useState<'overview' | 'settings' | 'setup'>('overview')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [setupInfo, setSetupInfo] = useState<SetupInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    color: 'blue',
    retention_days: '',
  })

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedId) ?? null,
    [selectedId, sources]
  )

  const loadSources = async (keepSelection = false) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/sources')
      if (!response.ok) {
        throw new Error('Failed to load sources')
      }
      const data = (await response.json()) as Source[]
      setSources(data)
      if (!keepSelection && data.length > 0) {
        setSelectedId(data[0].id)
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const loadSetup = async (sourceId: number) => {
    setSetupInfo(null)
    try {
      const response = await fetch(`/api/sources/${sourceId}/setup`)
      if (!response.ok) {
        throw new Error('Failed to load setup instructions')
      }
      const data = (await response.json()) as SetupInfo
      setSetupInfo(data)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
    }
  }

  useEffect(() => {
    void loadSources()
  }, [])

  useEffect(() => {
    if (panel === 'setup' && selectedSource) {
      void loadSetup(selectedSource.id)
    }
  }, [panel, selectedSource])

  const resetForm = (source?: Source) => {
    if (source) {
      setForm({
        name: source.name,
        color: source.color,
        retention_days: source.retention_days?.toString() ?? '',
      })
      return
    }
    setForm({
      name: '',
      color: 'blue',
      retention_days: '',
    })
  }

  const handleCreate = async () => {
    setError(null)
    const retentionValue = form.retention_days.trim()
      ? Number(form.retention_days)
      : undefined
    const payload = {
      name: form.name.trim(),
      color: form.color,
      ...(retentionValue ? { retention_days: retentionValue } : {}),
    }

    try {
      const response = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw new Error('Failed to create source')
      }
      await loadSources()
      setIsCreating(false)
      resetForm()
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
    }
  }

  const handleUpdate = async () => {
    if (!selectedSource) {
      return
    }
    setError(null)
    const retentionValue = form.retention_days.trim()
      ? Number(form.retention_days)
      : undefined
    const payload = {
      name: form.name.trim(),
      color: form.color,
      ...(retentionValue ? { retention_days: retentionValue } : {}),
    }

    try {
      const response = await fetch(`/api/sources/${selectedSource.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw new Error('Failed to update source')
      }
      await loadSources(true)
      setIsEditing(false)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
    }
  }

  const handleDelete = async () => {
    if (!selectedSource) {
      return
    }
    if (!window.confirm(`Delete ${selectedSource.name}? This cannot be undone.`)) {
      return
    }
    setError(null)
    try {
      const response = await fetch(`/api/sources/${selectedSource.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete source')
      }
      await loadSources()
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unknown error')
    }
  }

  const startCreate = () => {
    setIsCreating(true)
    setIsEditing(false)
    resetForm()
  }

  const startEdit = () => {
    if (!selectedSource) {
      return
    }
    setIsEditing(true)
    setIsCreating(false)
    resetForm(selectedSource)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Sessy recreation</p>
          <h1>Sources control room</h1>
        </div>
        <div className="topbar-actions">
          <button className="button ghost" type="button" onClick={startCreate}>
            New source
          </button>
          <button className="button primary" type="button" onClick={() => loadSources(true)}>
            Refresh
          </button>
        </div>
      </header>

      <div className="layout">
        <section className="panel">
          <div className="panel-header">
            <h2>Sources</h2>
            <span className="meta">
              {loading ? 'Loading...' : `${sources.length} total`}
            </span>
          </div>
          {error ? <p className="notice error">{error}</p> : null}
          <div className="source-list">
            {sources.map((source, index) => (
              <button
                key={source.id}
                type="button"
                className={`source-card ${selectedId === source.id ? 'selected' : ''} reveal`}
                style={{ '--delay': `${index * 0.05}s` } as CSSProperties}
                onClick={() => {
                  setSelectedId(source.id)
                  setPanel('overview')
                  setIsCreating(false)
                  setIsEditing(false)
                }}
              >
                <div className="source-card-title">
                  <span className={`palette-dot ${source.color}`} />
                  <span>{source.name}</span>
                </div>
                <div className="source-card-meta">
                  <span>Token</span>
                  <span className="mono">{source.token.slice(0, 8)}…</span>
                </div>
                <div className="source-card-meta">
                  <span>Retention</span>
                  <span>
                    {source.retention_days ? `${source.retention_days} days` : 'None'}
                  </span>
                </div>
              </button>
            ))}
            {!loading && sources.length === 0 ? (
              <div className="empty">
                <p>No sources yet.</p>
                <button className="button primary" type="button" onClick={startCreate}>
                  Create the first source
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel detail-panel">
          {isCreating || isEditing ? (
            <div className="detail">
              <div className="panel-header">
                <h2>{isEditing ? 'Edit source' : 'Create source'}</h2>
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => {
                    setIsCreating(false)
                    setIsEditing(false)
                  }}
                >
                  Cancel
                </button>
              </div>
              <div className="form">
                <label className="field">
                  <span>Name</span>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="e.g. Product alerts"
                  />
                </label>
                <label className="field">
                  <span>Color</span>
                  <div className="palette">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`palette-dot ${color} ${form.color === color ? 'active' : ''}`}
                        aria-label={color}
                        onClick={() => setForm((prev) => ({ ...prev, color }))}
                      />
                    ))}
                  </div>
                </label>
                <label className="field">
                  <span>Retention days (optional)</span>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    value={form.retention_days}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        retention_days: event.target.value,
                      }))
                    }
                    placeholder="30"
                  />
                </label>
                <div className="form-actions">
                  <button
                    className="button primary"
                    type="button"
                    onClick={isEditing ? handleUpdate : handleCreate}
                    disabled={!form.name.trim()}
                  >
                    {isEditing ? 'Save changes' : 'Create source'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedSource ? (
            <div className="detail">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Selected source</p>
                  <h2>{selectedSource.name}</h2>
                </div>
                <div className="actions">
                  <button className="button ghost" type="button" onClick={startEdit}>
                    Edit
                  </button>
                  <button className="button danger" type="button" onClick={handleDelete}>
                    Delete
                  </button>
                </div>
              </div>

              <div className="tabs">
                {(['overview', 'settings', 'setup'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`tab ${panel === tab ? 'active' : ''}`}
                    onClick={() => setPanel(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {panel === 'overview' ? (
                <div className="overview">
                  <div className="stat">
                    <span className="label">Token</span>
                    <span className="mono">{selectedSource.token}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Color</span>
                    <span className="chip">
                      <span className={`palette-dot ${selectedSource.color}`} />
                      {selectedSource.color}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="label">Retention</span>
                    <span>
                      {selectedSource.retention_days
                        ? `${selectedSource.retention_days} days`
                        : 'None'}
                    </span>
                  </div>
                  <div className="stat">
                    <span className="label">Created</span>
                    <span>{formatDate(selectedSource.created_at)}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Updated</span>
                    <span>{formatDate(selectedSource.updated_at)}</span>
                  </div>
                </div>
              ) : null}

              {panel === 'settings' ? (
                <div className="settings">
                  <h3>Retention policy</h3>
                  <p>
                    Set a retention window to automatically delete messages and events
                    older than the configured number of days.
                  </p>
                  <div className="callout">
                    <span className="label">Current retention</span>
                    <span>
                      {selectedSource.retention_days
                        ? `${selectedSource.retention_days} days`
                        : 'Not set'}
                    </span>
                  </div>
                  <button className="button ghost" type="button" onClick={startEdit}>
                    Update retention
                  </button>
                </div>
              ) : null}

              {panel === 'setup' ? (
                <div className="setup">
                  <h3>Setup guidance</h3>
                  {setupInfo ? (
                    <>
                      <div className="callout">
                        <div>
                          <span className="label">Configuration set</span>
                          <span className="mono">{setupInfo.configuration_set_name}</span>
                        </div>
                        <div>
                          <span className="label">SNS topic</span>
                          <span className="mono">{setupInfo.sns_topic_name}</span>
                        </div>
                        <div>
                          <span className="label">Webhook URL</span>
                          <span className="mono">{setupInfo.webhook_url}</span>
                        </div>
                      </div>
                      <ol className="steps">
                        {setupInfo.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <p className="muted">Loading setup instructions...</p>
                  )}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="detail empty">
              <p>Select a source to see details.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
