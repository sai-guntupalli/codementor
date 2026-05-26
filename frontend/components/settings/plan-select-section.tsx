"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Sparkles, Zap } from "lucide-react";
import { PageSection } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { apiFetch, type PlanOut, type UserPlanOut } from "@/lib/api";
import { cn } from "@/lib/utils";

type PlanSelectSectionProps = {
  token: string;
  onPlanChanged?: (plan: UserPlanOut) => void;
};

const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  Free: [
    "50 AI calls per month",
    "Hints, teach me, and chat",
    "Submit verified against examples",
  ],
  Pro: [
    "500 AI calls per month",
    "AI review on submit",
    "All models and practice features",
  ],
};

function formatPrice(monthly: number): string {
  if (monthly <= 0) return "Free";
  return `$${monthly.toFixed(0)}/mo`;
}

export function PlanSelectSection({ token, onPlanChanged }: PlanSelectSectionProps) {
  const [plans, setPlans] = useState<PlanOut[]>([]);
  const [userPlan, setUserPlan] = useState<UserPlanOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [planList, current] = await Promise.all([
        apiFetch<PlanOut[]>("/plans", { token }),
        apiFetch<UserPlanOut>("/users/me/plan", { token }),
      ]);
      setPlans(planList);
      setUserPlan(current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSelect(plan: PlanOut) {
    if (!userPlan?.dev_switch_enabled) return;
    if (userPlan.plan?.id === plan.id) return;

    setSwitchingId(plan.id);
    setError(null);
    try {
      const updated = await apiFetch<UserPlanOut>("/users/me/plan", {
        method: "PUT",
        token,
        body: JSON.stringify({ plan_id: plan.id }),
      });
      setUserPlan(updated);
      onPlanChanged?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to switch plan");
    } finally {
      setSwitchingId(null);
    }
  }

  const currentPlanId = userPlan?.plan?.id;

  return (
    <PageSection
      title="Plan"
      description={
        userPlan?.dev_switch_enabled
          ? "Development mode: switch plans without payment. Stripe checkout will replace this later."
          : "Your current subscription. Upgrade via checkout when billing is enabled."
      }
      icon={<CreditCard className="size-4 text-primary" />}
    >
      <div className="space-y-4 p-4 md:p-5">
        {loading && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {!loading && plans.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const isCurrent = currentPlanId === plan.id;
              const highlights = PLAN_HIGHLIGHTS[plan.name] ?? [];
              const isPro = plan.name.toLowerCase().includes("pro");

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-xl border p-4 transition-colors",
                    isCurrent
                      ? "border-primary/50 bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:border-primary/30"
                  )}
                >
                  {isCurrent && (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <Check className="size-3" />
                      Current
                    </span>
                  )}

                  <div className="mb-3 flex items-start gap-2">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        isPro ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isPro ? <Zap className="size-4" /> : <Sparkles className="size-4" />}
                    </span>
                    <div className="min-w-0 pr-16">
                      <h3 className="text-sm font-semibold">{plan.name}</h3>
                      <p className="text-lg font-bold tabular-nums tracking-tight">
                        {formatPrice(plan.price_monthly)}
                      </p>
                      {plan.price_yearly > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          or ${plan.price_yearly.toFixed(0)}/year (billing later)
                        </p>
                      )}
                    </div>
                  </div>

                  <ul className="mb-4 flex-1 space-y-1.5 text-xs text-muted-foreground">
                    {highlights.map((line) => (
                      <li key={line} className="flex gap-2">
                        <Check className="mt-0.5 size-3 shrink-0 text-primary/80" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>

                  {userPlan?.dev_switch_enabled ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={isCurrent ? "secondary" : "default"}
                      className="w-full"
                      disabled={isCurrent || switchingId !== null}
                      onClick={() => void handleSelect(plan)}
                    >
                      {switchingId === plan.id
                        ? "Switching…"
                        : isCurrent
                          ? "Selected"
                          : `Switch to ${plan.name}`}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={isCurrent || isPro}
                      title="Payment integration coming soon"
                    >
                      {isCurrent ? "Current plan" : "Upgrade (soon)"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {userPlan && !loading && (
          <p className="text-[11px] text-muted-foreground">
            {userPlan.ai_submit_review
              ? "Submit uses AI review on your current plan."
              : "Submit runs example tests only on your current plan."}{" "}
            {userPlan.subscription_status && (
              <span className="tabular-nums">Status: {userPlan.subscription_status}.</span>
            )}
          </p>
        )}
      </div>
    </PageSection>
  );
}
