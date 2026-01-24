import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../components/ui/input-group'
import { sourceSetupQueryOptions } from '../lib/queries'

export default function SourceSetupPage() {
  // @ts-ignore
  const { sourceId: sourceIdStr } = useParams({ strict: false })
  const sourceId = sourceIdStr ? Number(sourceIdStr) : null
  const [webhookCopied, setWebhookCopied] = useState(false)
  const [configSetCopied, setConfigSetCopied] = useState(false)
  const [snsTopicCopied, setSnsTopicCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const configSetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snsTopicTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: setupInfo, isLoading: loadingSetup, error } = useQuery(
    sourceSetupQueryOptions(sourceId)
  )

  if (loadingSetup) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-white/60">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
            <p>Loading configuration...</p>
        </div>
      )
  }

  if (error || !setupInfo) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-white/60">
            <p className="text-red-400 mb-2">Failed to load setup content.</p>
            <p className="text-sm opacity-60">{(error as Error)?.message}</p>
        </div>
      )
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <header className="mb-10">
        <p className="text-sm text-blue-400 font-medium mb-2">Integration guide</p>
        <h1 className="text-3xl font-display font-bold tracking-tight text-white">Connect SES + SNS</h1>
      </header>

      <div className="space-y-8">
        <section className="space-y-4">
             <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
                <div className="border-b border-white/5 bg-white/5 px-4 py-3">
                    <h3 className="text-sm font-semibold text-white">Required Configuration</h3>
                </div>
                 <div className="p-4 grid gap-4 sm:grid-cols-2">
                    <div>
                        <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-1.5">Configuration Set</span>
                        <InputGroup className="bg-white/10 border-white/10 text-white h-9">
                            <InputGroupInput
                                className="font-mono text-sm text-white h-9 py-0 leading-9"
                                readOnly
                                value={setupInfo.configuration_set_name}
                                onFocus={(event) => event.currentTarget.select()}
                            />
                            <InputGroupAddon align="inline-end">
                                <InputGroupButton
                                    size="sm"
                                    className="text-white/60 hover:text-white"
                                    onClick={() => {
                                        navigator.clipboard.writeText(setupInfo.configuration_set_name)
                                        if (configSetTimeoutRef.current) {
                                            clearTimeout(configSetTimeoutRef.current)
                                        }
                                        setConfigSetCopied(true)
                                        toast.success('Configuration set copied to clipboard.')
                                        configSetTimeoutRef.current = setTimeout(() => {
                                            setConfigSetCopied(false)
                                            configSetTimeoutRef.current = null
                                        }, 2000)
                                    }}
                                >
                                    {configSetCopied ? '✓ Copied' : 'Copy'}
                                </InputGroupButton>
                            </InputGroupAddon>
                        </InputGroup>
                    </div>
                    <div>
                        <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-1.5">SNS Topic Name</span>
                        <InputGroup className="bg-white/10 border-white/10 text-white h-9">
                            <InputGroupInput
                                className="font-mono text-sm text-white h-9 py-0 leading-9"
                                readOnly
                                value={setupInfo.sns_topic_name}
                                onFocus={(event) => event.currentTarget.select()}
                            />
                            <InputGroupAddon align="inline-end">
                                <InputGroupButton
                                    size="sm"
                                    className="text-white/60 hover:text-white"
                                    onClick={() => {
                                        navigator.clipboard.writeText(setupInfo.sns_topic_name)
                                        if (snsTopicTimeoutRef.current) {
                                            clearTimeout(snsTopicTimeoutRef.current)
                                        }
                                        setSnsTopicCopied(true)
                                        toast.success('SNS topic name copied to clipboard.')
                                        snsTopicTimeoutRef.current = setTimeout(() => {
                                            setSnsTopicCopied(false)
                                            snsTopicTimeoutRef.current = null
                                        }, 2000)
                                    }}
                                >
                                    {snsTopicCopied ? '✓ Copied' : 'Copy'}
                                </InputGroupButton>
                            </InputGroupAddon>
                        </InputGroup>
                    </div>
                    <div className="sm:col-span-2">
                        <span className="block text-xs uppercase tracking-wider text-white/40 font-semibold mb-1.5">Webhook URL</span>
                        <InputGroup className="bg-white/10 border-white/10 text-white h-9">
                            <InputGroupInput
                                className="font-mono text-sm text-white h-9 py-0 leading-9"
                                readOnly
                                value={setupInfo.webhook_url}
                                onFocus={(event) => event.currentTarget.select()}
                            />
                            <InputGroupAddon align="inline-end">
                                <InputGroupButton
                                    className="text-white/60 hover:text-white"
                                    onClick={() => {
                                        navigator.clipboard.writeText(setupInfo.webhook_url)
                                        if (copyTimeoutRef.current) {
                                            clearTimeout(copyTimeoutRef.current)
                                        }
                                        setWebhookCopied(true)
                                        toast.success('Webhook URL copied to clipboard.')
                                        copyTimeoutRef.current = setTimeout(() => {
                                            setWebhookCopied(false)
                                            copyTimeoutRef.current = null
                                        }, 2000)
                                    }}
                                >
                                    {webhookCopied ? '✓ Copied' : 'Copy'}
                                </InputGroupButton>
                            </InputGroupAddon>
                        </InputGroup>
                    </div>
                </div>
             </div>
        </section>

        <section>
            <h3 className="text-lg font-semibold text-white mb-6">Step-by-step Instructions</h3>
            <div className="space-y-0">
                 {setupInfo.steps.map((step, i) => (
                    <div key={i} className="group relative pl-10 pb-8 last:pb-0">
                        {/* Connecting line */}
                        {i !== setupInfo.steps.length - 1 && (
                            <div className="absolute left-3 top-6 bottom-0 w-px -translate-x-1/2 bg-white/10 group-hover:bg-white/20 transition-colors" />
                        )}
                        
                        {/* Step Counter */}
                        <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-mono font-medium text-white/60 ring-4 ring-[#0B0C0E] transition-colors group-hover:border-white/30 group-hover:bg-white/10 group-hover:text-white">
                            {i + 1}
                        </div>

                        {/* Content Card */}
                        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04] hover:border-white/10 hover:shadow-sm">
                            <p className="text-sm text-white/80 leading-relaxed">
                                {step}
                            </p>
                        </div>
                    </div>
                 ))}
            </div>
        </section>
      </div>
    </div>
  )
}
