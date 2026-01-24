import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  createSourceFn,
  deleteSourceFn,
  type Source,
  sourcesQueryOptions,
  sourceSetupQueryOptions,
  updateSourceFn,
} from './lib/queries'

const COLORS = ['purple', 'blue', 'cyan', 'green', 'red', 'orange', 'yellow', 'gray']

const formatDate = (value?: number | null) => {
  if (!value) {
    return '—'
  }
  return new Date(value).toLocaleDateString()
}

export default function App() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [panel, setPanel] = useState<'overview' | 'settings' | 'setup'>('overview')
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState({
    name: '',
    color: 'blue',
    retention_days: '',
  })
  const [error, setError] = useState<string | null>(null)

  const { data: sources = [], isLoading: loadingSources } = useQuery(sourcesQueryOptions)

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedId) ?? null,
    [selectedId, sources]
  )

  // Sync selectedId with first source if not set
  useEffect(() => {
    if (!selectedId && sources.length > 0) {
      setSelectedId(sources[0].id)
    }
  }, [sources, selectedId])

  const { data: setupInfo, isLoading: loadingSetup } = useQuery(
    sourceSetupQueryOptions(selectedSource?.id)
  )

  const createMutation = useMutation({
    mutationFn: createSourceFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      setIsCreating(false)
      resetForm()
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Unknown error')
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateSourceFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      setIsEditing(false)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Unknown error')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSourceFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      // If we deleted the selected source, the useEffect above will handle re-selection
      // or we can explicitly check here. For simplicity, let the effect handle it.
      if (selectedSource) {
         setSelectedId(null)
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Unknown error')
    },
  })

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

  const handleCreate = () => {
    setError(null)
    const retentionValue = form.retention_days.trim()
      ? Number(form.retention_days)
      : undefined
    
    createMutation.mutate({
      name: form.name.trim(),
      color: form.color,
      ...(retentionValue ? { retention_days: retentionValue } : {}),
    })
  }

  const handleUpdate = () => {
    if (!selectedSource) {
      return
    }
    setError(null)
    const retentionValue = form.retention_days.trim()
      ? Number(form.retention_days)
      : undefined
    
    updateMutation.mutate({
      id: selectedSource.id,
      payload: {
        name: form.name.trim(),
        color: form.color,
        ...(retentionValue ? { retention_days: retentionValue } : {}),
      },
    })
  }

  const handleDelete = () => {
    if (!selectedSource) {
      return
    }
    if (!window.confirm(`Delete ${selectedSource.name}? This cannot be undone.`)) {
      return
    }
    setError(null)
    deleteMutation.mutate(selectedSource.id)
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
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-[#0B0C0E] border-x border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-xs font-medium text-blue-400 mb-1">SESnoop recreation</p>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-white">Sources control room</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            className="text-sm font-medium text-white/60 hover:text-white transition-colors px-3 py-2" 
            type="button" 
            onClick={startCreate}
          >
            New source
          </button>
          <button 
             className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white/10 text-white hover:bg-white/20 border border-white/10 h-9 px-4 py-2 shadow-sm"
            type="button" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['sources'] })}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sources List Panel */}
        <section className="w-1/3 min-w-[320px] max-w-md border-r border-white/10 flex flex-col bg-white/[0.01]">
          <div className="flex items-center justify-between p-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Sources</h2>
            <span className="text-xs text-white/40 font-mono">
              {loadingSources ? 'Loading...' : `${sources.length} total`}
            </span>
          </div>
          {error ? <p className="px-4 py-3 text-sm text-red-400 bg-red-400/10 border-b border-red-400/20">{error}</p> : null}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sources.map((source) => (
              <button
                key={source.id}
                type="button"
                className={`w-full text-left p-3 rounded-lg transition-all duration-200 border ${
                  selectedId === source.id 
                    ? 'bg-white/10 border-white/10 shadow-sm' 
                    : 'bg-transparent border-transparent hover:bg-white/[0.03]'
                }`}
                onClick={() => {
                  setSelectedId(source.id)
                  setPanel('overview')
                  setIsCreating(false)
                  setIsEditing(false)
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ring-1 ring-white/20 bg-${source.color}-500/80 shadow-[0_0_8px_rgba(var(--color-${source.color}-500),0.5)]`} />
                    <span className="text-sm font-medium text-white">{source.name}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-white/40">
                  <div className="flex flex-col">
                    <span className="mb-0.5 uppercase tracking-wider text-[10px]">Token</span>
                    <span className="font-mono text-white/60">{source.token.slice(0, 8)}…</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="mb-0.5 uppercase tracking-wider text-[10px]">Retention</span>
                    <span className="text-white/60">
                      {source.retention_days ? `${source.retention_days} days` : 'None'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
            {!loadingSources && sources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-white/40 mb-4">No sources yet.</p>
                <button 
                   className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white/10 text-white hover:bg-white/20 border border-white/10 h-9 px-4 py-2 shadow-sm"
                  type="button" 
                  onClick={startCreate}
                >
                  Create the first source
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {/* Detail Panel */}
        <section className="flex-1 flex flex-col bg-[#0B0C0E] overflow-y-auto">
          {isCreating || isEditing ? (
            <div className="max-w-xl w-full mx-auto py-12 px-6">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-display font-semibold text-white">
                  {isEditing ? 'Edit source' : 'Create source'}
                </h2>
                <button
                  className="text-sm text-white/60 hover:text-white transition-colors"
                  type="button"
                  onClick={() => {
                    setIsCreating(false)
                    setIsEditing(false)
                  }}
                >
                  Cancel
                </button>
              </div>
              <div className="space-y-6">
                <label className="block">
                  <span className="block text-sm font-medium text-white/60 mb-2">Name</span>
                  <input
                    className="w-full bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-colors"
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="e.g. Product alerts"
                  />
                </label>
                <div>
                  <span className="block text-sm font-medium text-white/60 mb-2">Color</span>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-6 h-6 rounded-full border border-white/10 transition-transform ${
                          form.color === color ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0B0C0E]' : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: `var(--color-${color}-500, ${color})` }}
                        aria-label={color}
                        onClick={() => setForm((prev) => ({ ...prev, color }))}
                      />
                    ))}
                  </div>
                </div>
                <label className="block">
                  <span className="block text-sm font-medium text-white/60 mb-2">Retention days (optional)</span>
                  <input
                    className="w-full bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-colors"
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
                <div className="pt-4">
                  <button
                    className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white/10 text-white hover:bg-white/20 border border-white/10 h-10 px-4 py-2 shadow-sm"
                    type="button"
                    onClick={isEditing ? handleUpdate : handleCreate}
                    disabled={!form.name.trim() || createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending 
                      ? 'Saving...' 
                      : isEditing ? 'Save changes' : 'Create source'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedSource ? (
            <div className="flex-1 flex flex-col">
              <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-1">Selected source</p>
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-display font-semibold text-white">{selectedSource.name}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase font-bold tracking-wide text-white/50">
                      {selectedSource.color}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    className="px-3 py-1.5 text-xs font-medium text-white/60 border border-white/10 rounded-md hover:bg-white/5 transition-colors" 
                    type="button" 
                    onClick={startEdit}
                  >
                    Edit
                  </button>
                  <button 
                    className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-500/20 bg-red-500/5 rounded-md hover:bg-red-500/10 transition-colors" 
                    type="button" 
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>

              <div className="border-b border-white/10 px-8">
                <div className="flex space-x-6">
                  {(['overview', 'settings', 'setup'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                        panel === tab 
                          ? 'border-white text-white' 
                          : 'border-transparent text-white/40 hover:text-white/70'
                      }`}
                      onClick={() => setPanel(tab)}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-8 max-w-4xl">
                {panel === 'overview' ? (
                  <div className="max-w-2xl space-y-8">
                    <div>
                    <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3">Details</h3>
                      <div className="bg-white/[0.02] rounded-lg border border-white/10 divide-y divide-white/5">
                        <div className="flex items-center justify-between p-3">
                          <span className="text-sm text-white/60">Token</span>
                          <span className="font-mono text-sm text-white">{selectedSource.token}</span>
                        </div>
                        <div className="flex items-center justify-between p-3">
                          <span className="text-sm text-white/60">Retention policy</span>
                          <span className="text-sm text-white">
                            {selectedSource.retention_days
                              ? `${selectedSource.retention_days} days`
                              : 'Retain forever'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3">
                          <span className="text-sm text-white/60">Created</span>
                          <span className="text-sm text-white">{formatDate(selectedSource.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3">
                          <span className="text-sm text-white/60">Last updated</span>
                          <span className="text-sm text-white">{formatDate(selectedSource.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {panel === 'settings' ? (
                  <div className="max-w-2xl">
                    <h3 className="text-lg font-medium text-white mb-2">Retention policy</h3>
                    <p className="text-sm text-white/60 mb-6 leading-relaxed">
                      Set a retention window to automatically delete messages and events
                      older than the configured number of days.
                    </p>
                    <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/[0.02] mb-6">
                      <div className="flex flex-col">
                        <span className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-1">Current retention</span>
                        <span className="text-sm font-medium text-white">
                          {selectedSource.retention_days
                            ? `${selectedSource.retention_days} days`
                            : 'Not set (retain forever)'}
                        </span>
                      </div>
                      <button 
                        className="text-sm text-white/60 hover:text-white underline decoration-white/30" 
                        type="button" 
                        onClick={startEdit}
                      >
                        Update
                      </button>
                    </div>
                  </div>
                ) : null}

                {panel === 'setup' ? (
                  <div className="max-w-2xl">
                    <h3 className="text-lg font-medium text-white mb-6">Setup guidance</h3>
                    {setupInfo ? (
                      <div className="space-y-6">
                        <div className="grid gap-4 p-4 rounded-lg bg-white/[0.02] border border-white/10">
                          <div>
                            <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-1">Configuration set</span>
                            <code className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-sm">{setupInfo.configuration_set_name}</code>
                          </div>
                          <div>
                            <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-1">SNS topic</span>
                            <code className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-sm">{setupInfo.sns_topic_name}</code>
                          </div>
                          <div>
                            <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-1">Webhook URL</span>
                            <code className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono text-sm break-all">{setupInfo.webhook_url}</code>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {setupInfo.steps.map((step, i) => (
                            <div key={i} className="flex gap-4">
                              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-white/10 text-xs font-mono text-white/60 mt-0.5">
                                {i + 1}
                              </span>
                              <p className="text-sm text-white/80 leading-relaxed pt-0.5">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : loadingSetup ? (
                      <div className="flex items-center space-x-2 text-white/40">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        <span>Loading setup instructions...</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-white/30">
              <p>Select a source to see details.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
