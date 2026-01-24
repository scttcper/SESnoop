import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Plus, Settings, Activity } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  createSourceFn,
  sourcesQueryOptions,
} from '../lib/queries'
import { COLOR_STYLES, COLORS, cn } from '../lib/utils'

export default function SourcesPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)
  
  const [form, setForm] = useState({
    name: '',
    color: 'blue',
    retention_days: '',
  })
  const [error, setError] = useState<string | null>(null)

  const { data: sources = [], isLoading: loadingSources } = useQuery(sourcesQueryOptions)

  const createMutation = useMutation({
    mutationFn: createSourceFn,
    onSuccess: (newSource) => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      setIsCreating(false)
      setForm({
        name: '',
        color: 'blue',
        retention_days: '',
      })
      navigate({ to: '/s/$sourceId/setup', params: { sourceId: newSource.id.toString() } })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Unknown error')
    },
  })

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

  // If in creation mode, show a simple centralized form
  if (isCreating) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] bg-[#0B0C0E]">
            <div className="w-full max-w-md p-6">
                 <div className="mb-8 text-center">
                    <h1 className="text-2xl font-display font-bold text-white mb-2">Create new source</h1>
                    <p className="text-white/60">Set up a new endpoint to receive SES events.</p>
                 </div>

                 {error && (
                    <div className="mb-6 p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
                        {error}
                    </div>
                )}

                 <div className="space-y-6 bg-white/[0.02] border border-white/10 p-6 rounded-xl">
                    <label className="block">
                    <span className="block text-sm font-medium text-white/60 mb-2">Name</span>
                    <Input
                        autoFocus
                        className="w-full bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-colors"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Transactional Emails"
                    />
                    </label>

                    <div>
                    <span className="block text-sm font-medium text-white/60 mb-2">Color</span>
                    <div className="flex flex-wrap gap-2">
                        {COLORS.map((color) => (
                        <Button variant="ghost"
                            key={color}
                            type="button"
                            className={`w-8 h-8 rounded-full border border-white/10 transition-transform ${
                            form.color === color ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0B0C0E]' : 'hover:scale-110'
                            }`}
                            style={{ backgroundColor: `var(--color-${color}-500, ${color})` }}
                            aria-label={color}
                            onClick={() => setForm({ ...form, color })}
                        />
                        ))}
                    </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button 
                            variant="ghost"
                            className="flex-1 text-white/60 hover:text-white bg-transparent border border-white/10 hover:bg-white/5 disabled:opacity-50"
                            onClick={() => setIsCreating(false)}
                            disabled={createMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button 
                            className="flex-1 bg-white text-black hover:bg-white/90 disabled:opacity-50 font-medium"
                            onClick={handleCreate}
                            disabled={!form.name.trim() || createMutation.isPending}
                        >
                            {createMutation.isPending ? 'Creating...' : 'Create Source'}
                        </Button>
                    </div>
                 </div>
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-[#0B0C0E]">
      <div className="px-6 py-12 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-2xl font-display font-semibold tracking-tight text-white">Sources</h1>
                <p className="text-white/60 mt-1">Manage your event sources and configurations.</p>
            </div>
            <Button 
                onClick={() => setIsCreating(true)}
                className="bg-white text-black hover:bg-white/90 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
                <Plus className="h-4 w-4" />
                New Source
            </Button>
        </div>

        {loadingSources ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-40 rounded-xl border border-white/10 bg-white/[0.02] animate-pulse" />
                ))}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sources.map((source) => (
                    <div key={source.id} className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-all duration-200">
                        <div className="p-6 flex-1">
                            <div className="flex items-start justify-between mb-4">
                                <Link 
                                    to="/s/$sourceId/events" 
                                    params={{ sourceId: source.id.toString() }}
                                    className="flex items-center gap-3"
                                >
                                    <span className={cn("w-3 h-3 rounded-full ring-2 ring-white/10", COLOR_STYLES[source.color])} />
                                    <h2 className="text-lg font-semibold text-white group-hover:text-blue-200 transition-colors">
                                        {source.name}
                                    </h2>
                                </Link>
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Link
                                         to="/s/$sourceId/settings" 
                                         params={{ sourceId: source.id.toString() }}
                                         className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                         title="Settings"
                                    >
                                        <Settings className="w-4 h-4" />
                                    </Link>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs uppercase tracking-wider text-white/40 font-semibold mb-1 block">Ingestion Token</span>
                                    <code className="text-xs font-mono text-white/60 bg-white/5 px-2 py-1 rounded block truncate">
                                        {source.token}
                                    </code>
                                </div>
                                <div className="flex items-center gap-6 text-sm text-white/60">
                                   <div className="flex flex-col">
                                         <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-0.5">Retention</span>
                                         <span>{source.retention_days ? `${source.retention_days} days` : 'Forever'}</span>
                                   </div>
                                   <div className="flex flex-col">
                                         <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-0.5">Created</span>
                                         <span>{new Date(source.created_at || Date.now()).toLocaleDateString()}</span>
                                   </div>
                                </div>
                            </div>
                        </div>
                        <div className="border-t border-white/5 p-4 flex items-center justify-between bg-white/[0.01]">
                             <Link 
                                to="/s/$sourceId/events" 
                                params={{ sourceId: source.id.toString() }}
                                className="text-sm font-medium text-blue-400 hover:text-blue-300 flex items-center gap-2"
                             >
                                <Activity className="w-4 h-4" />
                                View Events
                             </Link>
                             <Link
                                to="/s/$sourceId/setup"
                                params={{ sourceId: source.id.toString() }}
                                className="text-xs font-medium text-white/40 hover:text-white transition-colors"
                             >
                                Setup Instructions
                             </Link>
                        </div>
                    </div>
                ))}
                
                {/* Empty State Card */}
                {sources.length === 0 && (
                    <button 
                        onClick={() => setIsCreating(true)}
                        className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed border-white/10 bg-transparent hover:bg-white/[0.02] hover:border-white/20 transition-all group"
                    >
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                            <Plus className="w-6 h-6 text-white/40 group-hover:text-white/80" />
                        </div>
                        <h3 className="text-white font-medium mb-1">Create your first source</h3>
                        <p className="text-sm text-white/40">Start capturing email events</p>
                    </button>
                )}
            </div>
        )}
      </div>
    </div>
  )
}
