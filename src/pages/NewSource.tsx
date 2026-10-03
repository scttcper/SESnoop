import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { useState } from 'react';

import {
  controlClassName,
  errorClassName,
  focusClassName,
  inputClassName,
  labelClassName,
  PageHeader,
  PageLayout,
  panelClassName,
  primaryControlClassName,
  secondaryControlClassName,
} from '../components/layout/PageLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { createSourceFn, sourcesQueryOptions } from '../lib/queries';
import { COLORS, cn } from '../lib/utils';

export default function NewSourcePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', color: 'blue', retention_days: '' });
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createSourceFn,
    onSuccess: async (newSource) => {
      await queryClient.invalidateQueries({ queryKey: sourcesQueryOptions.queryKey });
      await navigate({ to: '/s/$sourceId/setup', params: { sourceId: newSource.id } });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Could not create the source.');
    },
  });

  const handleCreate = () => {
    setError(null);
    const retentionValue = form.retention_days.trim() ? Number(form.retention_days) : undefined;

    createMutation.mutate({
      name: form.name.trim(),
      color: form.color,
      ...(retentionValue ? { retention_days: retentionValue } : {}),
    });
  };

  return (
    <PageLayout className="max-w-2xl">
      <PageHeader title="New source">
        <p className="mt-2 text-sm leading-6 text-white/45">
          Give this source a name, then connect its webhook to Amazon SES.
        </p>
      </PageHeader>

      <form
        className={cn(panelClassName, 'space-y-5 p-5 sm:p-6')}
        onSubmit={(event) => {
          event.preventDefault();
          handleCreate();
        }}
      >
        {error && (
          <div role="alert" className={errorClassName}>
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="source-name" className={labelClassName}>
            Source name
          </label>
          <Input
            id="source-name"
            autoFocus
            required
            maxLength={200}
            className={inputClassName}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="e.g. Production"
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
                onClick={() => setForm({ ...form, color })}
              >
                {form.color === color && <Check className="size-4" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
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
            onChange={(event) => setForm({ ...form, retention_days: event.target.value })}
            placeholder="No limit"
            aria-describedby="source-retention-help"
          />
          <p id="source-retention-help" className="text-xs leading-5 text-white/45">
            Leave blank to keep all events.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-white/[0.08] pt-5">
          <Button
            type="button"
            variant="ghost"
            className={cn(controlClassName, secondaryControlClassName)}
            onClick={() => void navigate({ to: '/sources' })}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className={cn(controlClassName, primaryControlClassName)}
            disabled={!form.name.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating…' : 'Create source'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
}
