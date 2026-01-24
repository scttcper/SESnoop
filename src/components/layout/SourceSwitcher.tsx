import { useNavigate, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Plus, Settings } from 'lucide-react'
import { sourcesQueryOptions } from '../../lib/queries'
import { cn, COLOR_STYLES } from '../../lib/utils'
import { useActiveSourceId } from '../../lib/use-active-source'
import { useSourceAwareNavigation } from '../../lib/use-source-navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectSeparator
} from '../ui/select'

export function SourceSwitcher() {
  const navigate = useNavigate()
  const { switchSource } = useSourceAwareNavigation()
  const currentSourceId = useActiveSourceId()
  
  const { data: sources = [] } = useQuery(sourcesQueryOptions)

  const selectedSource = sources.find((s) => s.id === currentSourceId)

  const handleSelect = (value: string | null) => {
    if (!value) return
    if (value === 'manage' || value === 'create') {
      navigate({ to: '/sources' })
      return
    }
    switchSource(value)
  }

  return (
    <Select value={currentSourceId?.toString() || ""} onValueChange={handleSelect}>
      <SelectTrigger className="w-[200px] border-white/10 bg-white/5 text-white hover:bg-white/10 focus:ring-0">
        <div className="flex items-center gap-2 truncate">
            {selectedSource ? (
                <>
                    <div className={cn("h-2 w-2 rounded-full", COLOR_STYLES[selectedSource.color])} />
                    <span className="truncate font-medium">{selectedSource.name}</span>
                </>
            ) : (
                <span className="text-white/50">Select source...</span>
            )}
        </div>
      </SelectTrigger>
      <SelectContent className="bg-[#0B0C0E] border-white/10 text-white">
        <div className="max-h-[300px] overflow-y-auto">
            {sources.length === 0 && (
                <div className="px-2 py-4 text-center text-sm text-white/50">
                    No sources found
                </div>
            )}
            {sources.map((source) => (
            <SelectItem key={source.id} value={source.id.toString()} className="focus:bg-white/10 cursor-pointer py-2">
                <div className="flex items-center gap-2">
                <div className={cn("h-3 w-3 rounded-full", COLOR_STYLES[source.color])} />
                <span className="text-base text-gray-200">{source.name}</span>
                </div>
            </SelectItem>
            ))}
        </div>
        <SelectSeparator className="bg-white/10" />
        <SelectItem value="create" className="focus:bg-white/10 cursor-pointer">
            <div className="flex items-center gap-2 text-white/60">
                <Plus className="h-4 w-4" />
                <span>Add Source</span>
            </div>
        </SelectItem>
        <SelectItem value="manage" className="focus:bg-white/10 cursor-pointer">
            <div className="flex items-center gap-2 text-white/60">
                <Settings className="h-4 w-4" />
                <span>Manage Sources</span>
            </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
