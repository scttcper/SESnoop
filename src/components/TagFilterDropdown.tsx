import { Menu } from '@base-ui/react';
import { Check, ChevronDown, Tags } from 'lucide-react';

import { cn } from '../lib/utils';

import {
  controlClassName,
  focusClassName,
  primaryControlClassName,
  secondaryControlClassName,
} from './layout/PageLayout';

type TagCountEntry = readonly [string, number];

interface TagFilterDropdownProps {
  selectedTags: readonly string[];
  tagCountEntries: readonly TagCountEntry[];
  onClearTags: () => void;
  onToggleTag: (tag: string) => void;
}

export function TagFilterDropdown({
  selectedTags,
  tagCountEntries,
  onClearTags,
  onToggleTag,
}: TagFilterDropdownProps) {
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          controlClassName,
          selectedTags.length > 0 ? primaryControlClassName : secondaryControlClassName,
        )}
      >
        <Tags className="size-4" aria-hidden="true" />
        <span>{selectedTags.length > 0 ? `Tags · ${selectedTags.length}` : 'Tags'}</span>
        <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={8} align="start">
          <Menu.Popup className="z-50 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-[#0D0E11] p-1.5 text-sm text-white shadow-2xl shadow-black/40 outline-none">
            <div className="grid grid-cols-[1fr_3rem] items-center gap-3 border-b border-white/10 px-2 py-1">
              <span className="text-xs font-medium text-white/40">Tags</span>
              <button
                type="button"
                className={cn(
                  focusClassName,
                  'h-7 rounded px-2 text-right text-xs font-medium text-white/45 transition-colors hover:bg-white/10 hover:text-white/75 disabled:pointer-events-none disabled:opacity-0',
                )}
                disabled={selectedTags.length === 0}
                onClick={onClearTags}
              >
                Clear
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {tagCountEntries.length === 0 ? (
                <p className="px-2 py-4 text-xs text-white/40">No tags match these filters.</p>
              ) : null}
              {tagCountEntries.map(([tag, count]) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Menu.CheckboxItem
                    key={tag}
                    checked={isSelected}
                    closeOnClick={false}
                    onCheckedChange={() => onToggleTag(tag)}
                    className="flex cursor-default items-center gap-2 rounded px-2 py-2 text-white/70 transition-colors outline-none data-[highlighted]:bg-white/[0.07] data-[highlighted]:text-white"
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center text-white/65">
                      {isSelected ? <Check className="size-3.5" aria-hidden="true" /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs">{tag}</span>
                    <span className="ml-3 min-w-8 shrink-0 text-right text-[11px] text-white/35 tabular-nums">
                      {count.toLocaleString()}
                    </span>
                  </Menu.CheckboxItem>
                );
              })}
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
