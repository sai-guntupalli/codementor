import { cn } from "@/lib/utils";

type PracticePanelProps = {
  children: React.ReactNode;
  className?: string;
};

/** Elevated white card panel for the practice workspace (Outlook-style). */
export function PracticePanel({ children, className }: PracticePanelProps) {
  return (
    <div className={cn("panel-card flex min-h-0 min-w-0 flex-col overflow-hidden", className)}>
      {children}
    </div>
  );
}
