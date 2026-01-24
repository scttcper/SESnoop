import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../components/ui/input-group'
import {
  deleteSourceFn,
  sourcesQueryOptions,
  updateSourceFn,
} from '../lib/queries'
import { COLOR_STYLES, COLORS } from '../lib/utils'

export default function SourceSettingsPage() {
  const navigate = useNavigate()
  // @ts-ignore
  const { sourceId: sourceIdStr } = useParams({ strict: false })
  const sourceId = sourceIdStr ? Number(sourceIdStr) : null
  const queryClient = useQueryClient()

  const { data: sources = [] } = useQuery(sourcesQueryOptions)
  const source = sources.find((s) => s.id === sourceId)

  const [form, setForm] = useState({
    name: '',
    color: 'blue',
    retention_days: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [tokenCopied, setTokenCopied] = useState(false)
  const tokenCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (source) {
      setForm({
        name: source.name,
        color: source.color,
        retention_days: source.retention_days?.toString() ?? '',
      })
    }
  }, [source])

  const updateMutation = useMutation({
    mutationFn: updateSourceFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      setError(null)
      toast.success('Settings saved.')
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      toast.error(`Failed to save settings: ${message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSourceFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      toast.success('Source deleted.')
      navigate({ to: '/sources' })
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      toast.error(`Failed to delete source: ${message}`)
    },
  })

  const handleUpdate = () => {
    if (!source) return
    setError(null)
    const retentionValue = form.retention_days.trim()
      ? Number(form.retention_days)
      : undefined // send undefined if empty to potentially clear? Or assume API handles it.
                  // Based on previous code, update payload allows undefined.

    updateMutation.mutate({
      id: source.id,
      payload: {
        name: form.name.trim(),
        color: form.color,
        retention_days: retentionValue, 
      },
    })
  }

  const handleDelete = () => {
    if (!source) return
    if (
      window.confirm(
        `Are you sure you want to delete "${source.name}"?\nAll associated events and messages will be permanently removed.`
      )
    ) {
      deleteMutation.mutate(source.id)
    }
  }

  if (!source) {
       return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-white/60">
            <p>Source not found.</p>
        </div>
      )
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <header className="mb-10 border-b border-white/10 pb-6">
        <h1 className="text-3xl font-display font-bold tracking-tight text-white">Settings</h1>
        <p className="text-white/60 mt-2">Manage configuration for <span className="text-white font-medium">{source.name}</span></p>
      </header>
      
      {error && (
        <div className="mb-6 p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
            {error}
        </div>
      )}

      <div className="space-y-10">
        
        {/* Token Section */}
        <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">API Credentials</h2>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <label className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-2">Ingestion Token</label>
                <InputGroup className="bg-black/30 border-white/10 text-white h-10">
                    <InputGroupInput
                        className="font-mono text-sm text-white h-10 py-0 leading-10"
                        readOnly
                        value={source.token}
                        onFocus={(event) => event.currentTarget.select()}
                    />
                    <InputGroupAddon align="inline-end">
                        <InputGroupButton
                            size="sm"
                            className="text-white/60 hover:text-white"
                            onClick={() => {
                                navigator.clipboard.writeText(source.token)
                                if (tokenCopyTimeoutRef.current) {
                                    clearTimeout(tokenCopyTimeoutRef.current)
                                }
                                setTokenCopied(true)
                                toast.success('Token copied to clipboard.')
                                tokenCopyTimeoutRef.current = setTimeout(() => {
                                    setTokenCopied(false)
                                    tokenCopyTimeoutRef.current = null
                                }, 2000)
                            }}
                        >
                            {tokenCopied ? '✓ Copied' : 'Copy'}
                        </InputGroupButton>
                    </InputGroupAddon>
                </InputGroup>
                <p className="text-xs text-white/40 mt-3">
                    This token is used to authenticate webhooks from SNS. Keep it secret.
                </p>
            </div>
        </section>

        {/* General Settings */}
        <section className="space-y-6">
            <h2 className="text-lg font-semibold text-white">General</h2>
            
            <div className="space-y-4">
                <label className="block">
                  <span className="block text-sm font-medium text-white/60 mb-2">Source Name</span>
                  <Input
                    className="w-full bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-colors"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>

                <div>
                  <span className="block text-sm font-medium text-white/60 mb-2">Color Label</span>
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
                        onClick={() => setForm(prev => ({ ...prev, color }))}
                      />
                    ))}
                  </div>
                </div>

                 <label className="block">
                  <span className="block text-sm font-medium text-white/60 mb-2">Retention Period (Days)</span>
                   <div className="flex gap-4">
                    <Input
                        className="w-32 bg-white/[0.03] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-colors"
                        type="number"
                        min="1"
                        value={form.retention_days}
                        onChange={(e) => setForm({ ...form, retention_days: e.target.value })}
                        placeholder="Forever"
                    />
                    <div className="flex-1 flex items-center text-sm text-white/40">
                         {form.retention_days ? `Events older than ${form.retention_days} days will be deleted.` : 'Events will be retained indefinitely.'}
                    </div>
                   </div>
                </label>
            </div>

            <div className="pt-2">
                 <Button
                    size="lg"
                    className="bg-white text-black hover:bg-white/90 h-10 px-6 rounded-md text-base font-medium transition-colors disabled:opacity-50"
                    disabled={!form.name.trim() || updateMutation.isPending}
                    onClick={handleUpdate}
                  >
                     {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                 </Button>
            </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4 pt-10 border-t border-white/10">
            <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 flex items-center justify-between">
                <div>
                    <h3 className="text-white font-medium">Delete Source</h3>
                    <p className="text-sm text-white/60 mt-1">Permanently delete this source and all its data.</p>
                </div>
                <Button 
                    variant="ghost"
                    className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    disabled={deleteMutation.isPending}
                    onClick={handleDelete}
                >
                    {deleteMutation.isPending ? 'Deleting...' : 'Delete Source'}
                </Button>
            </div>
        </section>

      </div>
    </div>
  )
}
