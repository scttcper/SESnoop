import { Menu } from '@base-ui/react';
import { Check, ChevronDown, Tags } from 'lucide-react';

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
    <div>
      <span className="mb-2 block text-sm font-medium text-white/60">Tags</span>
      <div className="flex flex-wrap items-center gap-2">
        <Menu.Root>
          <Menu.Trigger
            className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/30 ${
              selectedTags.length > 0
                ? 'border-white/20 bg-white/10 text-white hover:bg-white/15'
                : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white'
            }`}
            disabled={tagCountEntries.length === 0}
          >
            <Tags className="size-4" aria-hidden="true" />
            <span>
              {selectedTags.length > 0 ? `${selectedTags.length} selected` : 'Filter tags'}
            </span>
            <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={8} align="start">
              <Menu.Popup className="z-50 w-96 overflow-hidden rounded-md border border-white/10 bg-[#0D0E11] p-1.5 text-sm text-white shadow-2xl shadow-black/40 outline-none">
                <div className="grid grid-cols-[1fr_3rem] items-center gap-3 border-b border-white/10 px-2 py-1">
                  <span className="text-[11px] font-semibold tracking-wide text-white/40 uppercase">
                    Tags
                  </span>
                  <button
                    type="button"
                    className="h-6 rounded px-2 text-right text-[11px] font-medium text-white/45 transition-colors hover:bg-white/10 hover:text-white/75 disabled:pointer-events-none disabled:opacity-0"
                    disabled={selectedTags.length === 0}
                    onClick={onClearTags}
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
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
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">{tag}</span>
                        <span className="ml-3 min-w-8 shrink-0 text-right font-mono text-[11px] text-white/35">
                          {count}
                        </span>
                      </Menu.CheckboxItem>
                    );
                  })}
                </div>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </div>
  );
}
