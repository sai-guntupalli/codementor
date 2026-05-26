import { AppShell } from "@/components/layout/app-shell";
import { NotFoundView } from "@/components/layout/not-found-view";

export default function NotFound() {
  return (
    <AppShell>
      <NotFoundView variant="page" />
    </AppShell>
  );
}
