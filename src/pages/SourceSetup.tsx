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
                        <InputGroup className="bg-white/5 border-white/10 text-white">
                            <InputGroupInput
                                className="font-mono text-sm text-white"
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
            <h3 className="text-lg font-semibold text-white mb-4">Step-by-step Instructions</h3>
            <div className="space-y-6 border-l border-white/10 ml-3 pl-8 relative">
                 {setupInfo.steps.map((step, i) => (
                    <div key={i} className="relative">
                        <span className="absolute -left-[43px] flex items-center justify-center w-7 h-7 rounded-full bg-[#0B0C0E] border border-white/20 text-xs font-mono text-white/60">
                            {i + 1}
                        </span>
                        <p className="text-white/80 leading-relaxed bg-white/[0.02] p-4 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
                            {step}
                        </p>
                    </div>
                 ))}
            </div>
        </section>
      </div>
    </div>
  )
}
