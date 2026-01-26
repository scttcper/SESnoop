import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../components/ui/input-group';
import { sourceSetupQueryOptions } from '../lib/queries';

export default function SourceSetupPage() {
  const { sourceId: sourceIdStr } = useParams({ strict: false });
  const sourceId = sourceIdStr ? Number(sourceIdStr) : null;
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [configSetCopied, setConfigSetCopied] = useState(false);
  const [snsTopicCopied, setSnsTopicCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configSetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snsTopicTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    data: setupInfo,
    isLoading: loadingSetup,
    error,
  } = useQuery(sourceSetupQueryOptions(sourceId));

  if (loadingSetup) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-white/60">
        <div className="mb-4 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p>Loading configuration...</p>
      </div>
    );
  }

  if (error || !setupInfo) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-white/60">
        <p className="mb-2 text-red-400">Failed to load setup content.</p>
        <p className="text-sm opacity-60">{(error as Error)?.message}</p>
      </div>
    );
  }

  const inlineCodeClass =
    'cursor-pointer select-all rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/80 transition-colors hover:bg-white/20';
  const codeTooltip = 'Click to copy to clipboard.';
  const handleCopyInlineCode = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard.`);
  };
  const steps = [
    {
      key: 'sns-topic',
      content: (
        <>
          Create an SNS topic named{' '}
          <code
            className={inlineCodeClass}
            title={codeTooltip}
            role="button"
            tabIndex={0}
            onClick={() => handleCopyInlineCode(setupInfo.sns_topic_name, 'SNS topic name')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleCopyInlineCode(setupInfo.sns_topic_name, 'SNS topic name');
              }
            }}
          >
            {setupInfo.sns_topic_name}
          </code>
          .
        </>
      ),
    },
    {
      key: 'configuration-set',
      content: (
        <>
          Create or choose an SES configuration set named{' '}
          <code
            className={inlineCodeClass}
            title={codeTooltip}
            role="button"
            tabIndex={0}
            onClick={() =>
              handleCopyInlineCode(setupInfo.configuration_set_name, 'Configuration set name')
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleCopyInlineCode(setupInfo.configuration_set_name, 'Configuration set name');
              }
            }}
          >
            {setupInfo.configuration_set_name}
          </code>
          .
        </>
      ),
    },
    {
      key: 'subscription',
      content: (
        <>
          Add an HTTPS subscription to the SNS topic using{' '}
          <code
            className={inlineCodeClass}
            title={codeTooltip}
            role="button"
            tabIndex={0}
            onClick={() => handleCopyInlineCode(setupInfo.webhook_url, 'Webhook URL')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handleCopyInlineCode(setupInfo.webhook_url, 'Webhook URL');
              }
            }}
          >
            {setupInfo.webhook_url}
          </code>
          .
        </>
      ),
    },
    {
      key: 'event-destination',
      content: (
        <>
          In SES, add an Event Destination that publishes delivery, bounce, complaint, reject,
          delivery delay, rendering failure, open, click, and subscription events to the SNS topic.
        </>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-10">
        <p className="mb-2 text-sm font-medium text-blue-400">Integration guide</p>
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">
          Connect SES + SNS
        </h1>
      </header>

      <div className="space-y-8">
        <section className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]">
            <div className="border-b border-white/5 bg-white/5 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">Required Configuration</h3>
            </div>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <div>
                <span className="mb-1.5 block text-xs font-semibold tracking-wider text-white/40 uppercase">
                  Configuration Set
                </span>
                <InputGroup className="h-9 border-white/10 bg-white/10 text-white">
                  <InputGroupInput
                    className="h-9 py-0 font-mono text-sm leading-9 text-white"
                    readOnly
                    value={setupInfo.configuration_set_name}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="sm"
                      className="text-white/60 hover:text-white"
                      onClick={() => {
                        navigator.clipboard.writeText(setupInfo.configuration_set_name);
                        if (configSetTimeoutRef.current) {
                          clearTimeout(configSetTimeoutRef.current);
                        }
                        setConfigSetCopied(true);
                        toast.success('Configuration set copied to clipboard.');
                        configSetTimeoutRef.current = setTimeout(() => {
                          setConfigSetCopied(false);
                          configSetTimeoutRef.current = null;
                        }, 2000);
                      }}
                    >
                      {configSetCopied ? '✓ Copied' : 'Copy'}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>
              <div>
                <span className="mb-1.5 block text-xs font-semibold tracking-wider text-white/40 uppercase">
                  SNS Topic Name
                </span>
                <InputGroup className="h-9 border-white/10 bg-white/10 text-white">
                  <InputGroupInput
                    className="h-9 py-0 font-mono text-sm leading-9 text-white"
                    readOnly
                    value={setupInfo.sns_topic_name}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="sm"
                      className="text-white/60 hover:text-white"
                      onClick={() => {
                        navigator.clipboard.writeText(setupInfo.sns_topic_name);
                        if (snsTopicTimeoutRef.current) {
                          clearTimeout(snsTopicTimeoutRef.current);
                        }
                        setSnsTopicCopied(true);
                        toast.success('SNS topic name copied to clipboard.');
                        snsTopicTimeoutRef.current = setTimeout(() => {
                          setSnsTopicCopied(false);
                          snsTopicTimeoutRef.current = null;
                        }, 2000);
                      }}
                    >
                      {snsTopicCopied ? '✓ Copied' : 'Copy'}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </div>
              <div className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold tracking-wider text-white/40 uppercase">
                  Webhook URL
                </span>
                <InputGroup className="h-9 border-white/10 bg-white/10 text-white">
                  <InputGroupInput
                    className="h-9 py-0 font-mono text-sm leading-9 text-white"
                    readOnly
                    value={setupInfo.webhook_url}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      className="text-white/60 hover:text-white"
                      onClick={() => {
                        navigator.clipboard.writeText(setupInfo.webhook_url);
                        if (copyTimeoutRef.current) {
                          clearTimeout(copyTimeoutRef.current);
                        }
                        setWebhookCopied(true);
                        toast.success('Webhook URL copied to clipboard.');
                        copyTimeoutRef.current = setTimeout(() => {
                          setWebhookCopied(false);
                          copyTimeoutRef.current = null;
                        }, 2000);
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
          <h3 className="mb-6 text-lg font-semibold text-white">Step-by-step Instructions</h3>
          <div className="space-y-0">
            {steps.map((step, i) => (
              <div key={step.key} className="group relative pb-8 pl-10 last:pb-0">
                {/* Connecting line */}
                {i !== steps.length - 1 && (
                  <div className="absolute top-6 bottom-0 left-3 w-px -translate-x-1/2 bg-white/10 transition-colors group-hover:bg-white/20" />
                )}

                {/* Step Counter */}
                <div className="absolute top-0 left-0 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/5 font-mono text-[10px] font-medium text-white/60 ring-4 ring-[#0B0C0E] transition-colors group-hover:border-white/30 group-hover:bg-white/10 group-hover:text-white">
                  {i + 1}
                </div>

                {/* Content Card */}
                <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-white/10 hover:bg-white/[0.04] hover:shadow-sm">
                  <p className="text-sm leading-relaxed text-white/80">{step.content}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
