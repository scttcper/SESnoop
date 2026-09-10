import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  controlClassName,
  errorClassName,
  labelClassName,
  PageHeader,
  PageLayout,
  panelClassName,
  secondaryControlClassName,
  sectionHeadingClassName,
} from '../components/layout/PageLayout';
import { sourceSetupQueryOptions } from '../lib/queries';
import { cn } from '../lib/utils';

function ConfigurationValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setCopied(true);
      toast.success(`${label} copied.`);
      timeoutRef.current = setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 2000);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}. Select the value to copy it manually.`);
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      <dt className={labelClassName}>{label}</dt>
      <dd className="flex min-w-0 items-start gap-3 rounded-lg border border-white/[0.08] bg-black/10 p-2">
        <code className="min-w-0 flex-1 py-2 pl-1 font-mono text-xs leading-5 [overflow-wrap:anywhere] text-white/75 select-all">
          {value}
        </code>
        <button
          type="button"
          className={cn(controlClassName, secondaryControlClassName, 'shrink-0 gap-1.5')}
          onClick={copyValue}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </dd>
    </div>
  );
}

export default function SourceSetupPage() {
  const { sourceId: sourceIdStr } = useParams({ strict: false });
  const sourceId = sourceIdStr ? Number(sourceIdStr) : null;
  const {
    data: setupInfo,
    isLoading: loadingSetup,
    error,
  } = useQuery(sourceSetupQueryOptions(sourceId));

  return (
    <PageLayout>
      <PageHeader title="Source setup">
        <p className="mt-2 text-sm break-words text-white/45">
          Connect Amazon SES to {setupInfo?.source.name ?? 'this source'} through SNS.
        </p>
      </PageHeader>

      {loadingSetup ? (
        <div className={cn(panelClassName, 'p-6 text-sm text-white/45')} role="status">
          Loading setup…
        </div>
      ) : error || !setupInfo ? (
        <div className={errorClassName} role="alert">
          <p>Could not load source setup.</p>
          {error ? <p className="mt-2 text-xs text-white/45">{error.message}</p> : null}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <section className={cn(panelClassName, 'min-w-0 p-5')}>
            <h2 className={sectionHeadingClassName}>Required values</h2>
            <dl className="mt-5 space-y-5">
              <ConfigurationValue
                label="Configuration set"
                value={setupInfo.configuration_set_name}
              />
              <ConfigurationValue label="SNS topic name" value={setupInfo.sns_topic_name} />
              <ConfigurationValue label="Webhook URL" value={setupInfo.webhook_url} />
            </dl>
          </section>

          <section className={cn(panelClassName, 'min-w-0 p-5')}>
            <h2 className={sectionHeadingClassName}>Connect in AWS</h2>
            <ol className="mt-5 space-y-6">
              {[
                {
                  title: 'Create an SNS topic',
                  content: <>Use the SNS topic name shown in the required values.</>,
                },
                {
                  title: 'Create an SES configuration set',
                  content: <>Create or choose a set with the configuration set name shown here.</>,
                },
                {
                  title: 'Subscribe the webhook',
                  content: (
                    <>
                      Add an HTTPS subscription to the SNS topic. Use the webhook URL as the
                      endpoint.
                    </>
                  ),
                },
                {
                  title: 'Add an event destination',
                  content: (
                    <>
                      <p>
                        In the configuration set, add an SNS event destination that points to the
                        topic. Include send, delivery, bounce, complaint, reject, delivery delay,
                        and rendering failure events.
                      </p>
                      <p className="mt-3 text-white/40">
                        <span className="font-medium text-white/60">Optional:</span> enable open,
                        click, and subscription events for engagement tracking. These can
                        significantly increase webhook and database volume.
                      </p>
                    </>
                  ),
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] font-medium text-white/50 tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-xs font-medium text-white/80">{step.title}</h3>
                    <div className="mt-2 text-xs leading-5 text-white/50">{step.content}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </PageLayout>
  );
}
