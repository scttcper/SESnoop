import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  controlClassName,
  dangerControlClassName,
  errorClassName,
  focusClassName,
  inputClassName,
  labelClassName,
  PageHeader,
  PageLayout,
  panelClassName,
  primaryControlClassName,
  secondaryControlClassName,
  sectionHeadingClassName,
} from '../components/layout/PageLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  deleteSourceFn,
  runSourceCleanupFn,
  sourcesQueryOptions,
  updateSourceFn,
} from '../lib/queries';
import { cn, COLORS } from '../lib/utils';

type SourceForm = { name: string; color: string; retention_days: string };

export default function SourceSettingsPage() {
  const navigate = useNavigate();
  const { sourceId: sourceIdStr } = useParams({ strict: false });
  const sourceId = sourceIdStr ? Number(sourceIdStr) : null;
  const queryClient = useQueryClient();

  const {
    data: sources = [],
    isLoading: loadingSources,
    error: sourcesError,
    refetch,
  } = useQuery(sourcesQueryOptions);
  const source = sources.find((s) => s.id === sourceId);

  const [draft, setDraft] = useState<{ sourceId: number; values: SourceForm } | null>(null);
  const form =
    draft && draft.sourceId === sourceId
      ? draft.values
      : {
          name: source?.name ?? '',
          color: source?.color ?? 'blue',
          retention_days: source?.retention_days?.toString() ?? '',
        };
  const [error, setError] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const tokenCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateForm = (values: Partial<SourceForm>) => {
    if (source) {
      setDraft({ sourceId: source.id, values: { ...form, ...values } });
    }
  };

  useEffect(
    () => () => {
      if (tokenCopyTimeoutRef.current) {
        clearTimeout(tokenCopyTimeoutRef.current);
      }
    },
    [],
  );

  const updateMutation = useMutation({
    mutationFn: updateSourceFn,
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['sources'] });
      setDraft((current) => (current?.sourceId === variables.id ? null : current));
      setError(null);
      toast.success('Settings saved.');
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast.error(`Failed to save settings: ${message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSourceFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      toast.success('Source deleted.');
      navigate({ to: '/sources' });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast.error(`Failed to delete source: ${message}`);
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: runSourceCleanupFn,
    onSuccess: (result) => {
      const deletedCount =
        result.messages_deleted + result.events_deleted + result.webhooks_deleted;

      if (deletedCount === 0) {
        toast.success('Cleanup complete. Nothing to delete.');
        return;
      }

      toast.success(
        `Cleanup complete. Deleted ${result.messages_deleted} messages, ${result.events_deleted} events, and ${result.webhooks_deleted} webhooks.`,
      );
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to run cleanup: ${message}`);
    },
  });

  const handleUpdate = () => {
    if (!source) {
      return;
    }
    setError(null);
    const retentionValue = form.retention_days.trim() ? Number(form.retention_days) : null;

    updateMutation.mutate({
      id: source.id,
      payload: {
        name: form.name.trim(),
        color: form.color,
        retention_days: retentionValue,
      },
    });
  };

  const handleDelete = () => {
    if (!source) {
      return;
    }
    if (
      window.confirm(
        `Are you sure you want to delete "${source.name}"?\nAll associated events and messages will be permanently removed.`,
      )
    ) {
      deleteMutation.mutate(source.id);
    }
  };

  const handleCleanup = () => {
    if (!source) {
      return;
    }
    if (
      window.confirm(
        `Run retention cleanup now for "${source.name}"?\nThis will delete messages and events older than the retention period.`,
      )
    ) {
      cleanupMutation.mutate(source.id);
    }
  };

  const handleCopyToken = async () => {
    if (!source) {
      return;
    }
    try {
      await navigator.clipboard.writeText(source.token);
      if (tokenCopyTimeoutRef.current) {
        clearTimeout(tokenCopyTimeoutRef.current);
      }
      setTokenCopied(true);
      toast.success('Token copied to clipboard.');
      tokenCopyTimeoutRef.current = setTimeout(() => {
        setTokenCopied(false);
        tokenCopyTimeoutRef.current = null;
      }, 2000);
    } catch {
      toast.error('Could not copy the token. Select it and copy manually.');
    }
  };

  if (loadingSources) {
    return (
      <PageLayout className="max-w-4xl">
        <PageHeader title="Settings" />
        <div role="status" className="space-y-5">
          <span className="sr-only">Loading source settings…</span>
          <div className={cn(panelClassName, 'h-80 animate-pulse')} />
          <div className={cn(panelClassName, 'h-40 animate-pulse')} />
          <div className={cn(panelClassName, 'h-52 animate-pulse')} />
        </div>
      </PageLayout>
    );
  }

  if (!source) {
    return (
      <PageLayout className="max-w-4xl">
        <PageHeader title="Settings" />
        {sourcesError ? (
          <div role="alert" className={errorClassName}>
            <p>Could not load this source. {sourcesError.message}</p>
            <Button
              variant="ghost"
              className={cn(controlClassName, secondaryControlClassName, 'mt-3')}
              onClick={() => refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <div className={cn(panelClassName, 'p-6')}>
            <p className="text-sm text-white/60">This source could not be found.</p>
            <Link to="/sources" className={cn(controlClassName, secondaryControlClassName, 'mt-4')}>
              View sources
            </Link>
          </div>
        )}
      </PageLayout>
    );
  }

  return (
    <PageLayout className="max-w-4xl">
      <PageHeader
        title="Settings"
        actions={
          <Link
            to="/s/$sourceId/setup"
            params={{ sourceId: source.id.toString() }}
            className={cn(controlClassName, secondaryControlClassName)}
          >
            Webhook setup
          </Link>
        }
      >
        <p className="mt-2 truncate text-sm text-white/45">{source.name}</p>
      </PageHeader>

      {error && (
        <div role="alert" className={cn(errorClassName, 'mb-5')}>
          {error}
        </div>
      )}

      <div className="space-y-5">
        <form
          className={cn(panelClassName, 'overflow-hidden')}
          onSubmit={(event) => {
            event.preventDefault();
            handleUpdate();
          }}
        >
          <div className="space-y-5 p-5 sm:p-6">
            <h2 className={sectionHeadingClassName}>General</h2>
            <div className="max-w-xl space-y-2">
              <label htmlFor="source-name" className={labelClassName}>
                Source name
              </label>
              <Input
                id="source-name"
                required
                maxLength={200}
                className={inputClassName}
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className={labelClassName}>Color</legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      focusClassName,
                      'flex size-9 items-center justify-center rounded-lg border text-white transition-colors',
                      form.color === color
                        ? 'border-white/80'
                        : 'border-white/10 hover:border-white/40',
                    )}
                    style={{ backgroundColor: `var(--color-${color}-500, ${color})` }}
                    aria-label={color}
                    aria-pressed={form.color === color}
                    onClick={() => updateForm({ color })}
                  >
                    {form.color === color && <Check className="size-4" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2 border-t border-white/[0.08] pt-5">
              <label htmlFor="source-retention" className={labelClassName}>
                Retention in days
              </label>
              <Input
                id="source-retention"
                className={cn(inputClassName, 'max-w-36')}
                type="number"
                min={1}
                step={1}
                value={form.retention_days}
                onChange={(event) => updateForm({ retention_days: event.target.value })}
                placeholder="No limit"
                aria-describedby="source-retention-help"
              />
              <p id="source-retention-help" className="max-w-lg text-xs leading-5 text-white/45">
                Messages and events older than this period are deleted. Leave blank for no limit.
              </p>
            </div>
          </div>
          <div className="flex justify-end border-t border-white/[0.08] px-5 py-4 sm:px-6">
            <Button
              type="submit"
              className={cn(controlClassName, primaryControlClassName)}
              disabled={!form.name.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>

        <section className={cn(panelClassName, 'p-5 sm:p-6')}>
          <h2 className={sectionHeadingClassName}>Webhook access</h2>
          <div className="mt-5 space-y-2">
            <label htmlFor="ingestion-token" className={labelClassName}>
              Ingestion token
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="ingestion-token"
                className={cn(inputClassName, 'font-mono text-xs')}
                readOnly
                value={source.token}
                onFocus={(event) => event.currentTarget.select()}
                aria-describedby="ingestion-token-help"
              />
              <Button
                type="button"
                variant="ghost"
                className={cn(controlClassName, secondaryControlClassName)}
                onClick={handleCopyToken}
                aria-label={tokenCopied ? 'Token copied' : 'Copy ingestion token'}
              >
                {tokenCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {tokenCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p id="ingestion-token-help" className="text-xs leading-5 text-white/45">
              Included in your webhook URL to identify this source. Keep it private.
            </p>
          </div>
        </section>

        <section className={cn(panelClassName, 'overflow-hidden')}>
          <h2 className={cn(sectionHeadingClassName, 'px-5 pt-5 sm:px-6 sm:pt-6')}>
            Data management
          </h2>
          <div className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-white/80">Delete expired data</h3>
              <p id="cleanup-help" className="mt-1.5 max-w-lg text-xs leading-5 text-white/45">
                {source.retention_days
                  ? `Permanently remove messages and events older than the saved ${source.retention_days}-day retention period.`
                  : 'Set and save a retention period above to remove expired data.'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className={cn(controlClassName, secondaryControlClassName)}
              disabled={cleanupMutation.isPending || !source.retention_days}
              onClick={handleCleanup}
              aria-describedby="cleanup-help"
            >
              {cleanupMutation.isPending ? 'Deleting…' : 'Delete expired data'}
            </Button>
          </div>
          <div className="flex flex-col items-start justify-between gap-4 border-t border-white/[0.08] p-5 sm:flex-row sm:items-center sm:p-6">
            <div className="min-w-0">
              <h3 className="text-sm font-medium text-white/80">Delete source</h3>
              <p className="mt-1.5 text-xs leading-5 text-white/45">
                Permanently remove this source and all its messages and events.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className={cn(controlClassName, dangerControlClassName)}
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete source'}
            </Button>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
