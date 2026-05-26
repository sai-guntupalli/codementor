import Link from "next/link";
import { Sparkles } from "lucide-react";
import { UsageMeter } from "@/components/usage/usage-meter";
import type { UsageOut } from "@/lib/api";

export function DashboardAiUsage({ usage }: { usage: UsageOut }) {
  return (
    <section className="panel-card p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">AI usage</h2>
        </div>
        <Link href="/settings" className="text-xs font-medium text-primary hover:underline">
          Settings →
        </Link>
      </div>
      <UsageMeter usage={usage} compact />
    </section>
  );
}
