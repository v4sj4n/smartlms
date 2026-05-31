import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import type { DashboardPriorityItem } from "@/lib/actions/dashboard-intelligence"
import { AlertCircle, CheckCircle2, ArrowRight, Clock } from "lucide-react"

type DashboardPriorityPanelProps = {
  important: DashboardPriorityItem[]
  notImportant: DashboardPriorityItem[]
  title?: string
}

function PriorityCard({ item }: { item: DashboardPriorityItem }) {
  const isImportant = item.level === "important"
  const Icon = isImportant ? AlertCircle : CheckCircle2

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background p-2.5 transition-colors hover:bg-muted/50 hover:border-border">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isImportant ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
        <Icon className={`h-3.5 w-3.5 ${isImportant ? "text-amber-600" : "text-emerald-600"}`} />
      </div>
      
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
          <Badge 
            variant="secondary" 
            className={`shrink-0 text-[10px] px-1.5 py-0 h-4 font-medium ${
              isImportant 
                ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {isImportant ? "High priority" : "Low priority"}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          {item.courseTitle && (
            <span className="truncate max-w-30">{item.courseTitle}</span>
          )}
          {item.courseTitle && item.dueLabel && <span className="text-border">•</span>}
          {item.dueLabel && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {item.dueLabel}
            </span>
          )}
        </div>
      </div>

      {item.href && (
        <Link 
          href={item.href} 
          className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

export function DashboardPriorityPanel({
  important,
  notImportant,
  title = "Tasks",
}: DashboardPriorityPanelProps) {
  const visibleImportant = important.slice(0, 4)
  const visibleNotImportant = notImportant.slice(0, 4)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {important.length + notImportant.length} pending
          </p>
        </div>
        {(important.length > 0 || notImportant.length > 0) && (
          <Badge variant="outline" className="text-[10px] h-5">
            {important.length} high
          </Badge>
        )}
      </div>

      <div className="space-y-1.5">
        {visibleImportant.length > 0 ? (
          visibleImportant.map((item) => <PriorityCard key={item.id} item={item} />)
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">No urgent items</p>
          </div>
        )}

        {visibleNotImportant.length > 0 && (
          <>
            <div className="h-px bg-border/50 my-2" />
            {visibleNotImportant.map((item) => (
              <PriorityCard key={item.id} item={item} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
