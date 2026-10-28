import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** A titled dashboard card. `badge` sits next to the title (e.g. the preview label). */
export function DashboardSection({
  id,
  title,
  description,
  badge,
  className,
  children,
}: {
  id: string
  title: string
  description: string
  badge?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn("gap-5 shadow-none", className)} aria-labelledby={`${id}-title`} role="region">
      <CardHeader>
        <CardTitle>
          <h2 id={`${id}-title`} className="flex flex-wrap items-center gap-2 text-base font-semibold">
            {title}
            {badge}
          </h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
