import { PageTransition } from "@/components/motion/page-transition"

// A template remounts on every navigation, which replays the page fade-in.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
