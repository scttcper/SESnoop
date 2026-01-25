import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../components/ui/input-group';
import { deleteSourceFn, sourcesQueryOptions, updateSourceFn } from '../lib/queries';
import { COLOR_STYLES, COLORS } from '../lib/utils';

export default function SourceSettingsPage() {
  const navigate = useNavigate();
  const { sourceId: sourceIdStr } = useParams({ strict: false });
  const sourceId = sourceIdStr ? Number(sourceIdStr) : null;
  const queryClient = useQueryClient();

  const { data: sources = [] } = useQuery(sourcesQueryOptions);
  const source = sources.find((s) => s.id === sourceId);

  const [form, setForm] = useState({
    name: '',
    color: 'blue',
    retention_days: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const tokenCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (source) {
      setForm({
        name: source.name,
        color: source.color,
        retention_days: source.retention_days?.toString() ?? '',
      });
    }
  }, [source]);

  const updateMutation = useMutation({
    mutationFn: updateSourceFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
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

  const handleUpdate = () => {
    if (!source) return;
    setError(null);
    const retentionValue = form.retention_days.trim() ? Number(form.retention_days) : undefined; // send undefined if empty to potentially clear? Or assume API handles it.
    // Based on previous code, update payload allows undefined.

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
    if (!source) return;
    if (
      window.confirm(
        `Are you sure you want to delete "${source.name}"?\nAll associated events and messages will be permanently removed.`,
      )
    ) {
      deleteMutation.mutate(source.id);
    }
  };

  if (!source) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-white/60">
        <p>Source not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-10 border-b border-white/10 pb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white">Settings</h1>
        <p className="mt-2 text-white/60">
          Manage configuration for <span className="font-medium text-white">{source.name}</span>
        </p>
      </header>

      {error && (
        <div className="mb-6 rounded-md border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-10">
        {/* Token Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">API Credentials</h2>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <label className="mb-2 block text-xs font-semibold tracking-wider text-white/40 uppercase">
              Ingestion Token
            </label>
            <InputGroup className="h-10 border-white/10 bg-black/30 text-white">
              <InputGroupInput
                className="h-10 py-0 font-mono text-sm leading-10 text-white"
                readOnly
                value={source.token}
                onFocus={(event) => event.currentTarget.select()}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="sm"
                  className="text-white/60 hover:text-white"
                  onClick={() => {
                    navigator.clipboard.writeText(source.token);
                    if (tokenCopyTimeoutRef.current) {
                      clearTimeout(tokenCopyTimeoutRef.current);
                    }
                    setTokenCopied(true);
                    toast.success('Token copied to clipboard.');
                    tokenCopyTimeoutRef.current = setTimeout(() => {
                      setTokenCopied(false);
                      tokenCopyTimeoutRef.current = null;
                    }, 2000);
                  }}
                >
                  {tokenCopied ? '✓ Copied' : 'Copy'}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <p className="mt-3 text-xs text-white/40">
              This token is used to authenticate webhooks from SNS. Keep it secret.
            </p>
          </div>
        </section>

        {/* General Settings */}
        <section className="space-y-6">
          <h2 className="text-lg font-semibold text-white">General</h2>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/60">Source Name</span>
              <Input
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white transition-colors placeholder:text-white/20 focus:border-white/30 focus:ring-1 focus:ring-white/30 focus:outline-none"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <div>
              <span className="mb-2 block text-sm font-medium text-white/60">Color Label</span>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <Button
                    variant="ghost"
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border border-white/10 transition-transform ${
                      form.color === color
                        ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#0B0C0E]'
                        : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: `var(--color-${color}-500, ${color})` }}
                    aria-label={color}
                    onClick={() => setForm((prev) => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-white/60">
                Retention Period (Days)
              </span>
              <div className="flex gap-4">
                <Input
                  className="w-32 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white transition-colors placeholder:text-white/20 focus:border-white/30 focus:ring-1 focus:ring-white/30 focus:outline-none"
                  type="number"
                  min="1"
                  value={form.retention_days}
                  onChange={(e) => setForm({ ...form, retention_days: e.target.value })}
                  placeholder="Forever"
                />
                <div className="flex flex-1 items-center text-sm text-white/40">
                  {form.retention_days
                    ? `Events older than ${form.retention_days} days will be deleted.`
                    : 'Events will be retained indefinitely.'}
                </div>
              </div>
            </label>
          </div>

          <div className="pt-2">
            <Button
              size="lg"
              className="h-10 rounded-md bg-white px-6 text-base font-medium text-black transition-colors hover:bg-white/90 disabled:opacity-50"
              disabled={!form.name.trim() || updateMutation.isPending}
              onClick={handleUpdate}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4 border-t border-white/10 pt-10">
          <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
          <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div>
              <h3 className="font-medium text-white">Delete Source</h3>
              <p className="mt-1 text-sm text-white/60">
                Permanently delete this source and all its data.
              </p>
            </div>
            <Button
              variant="ghost"
              className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Source'}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
