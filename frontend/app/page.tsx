import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <h1 className="text-4xl font-bold tracking-tight text-foreground">CodeMentor</h1>
      <p className="mt-4 text-muted-foreground text-center max-w-md">
        Your adaptive coding learning platform for Python and SQL.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/signup">
          <Button size="lg">Get started</Button>
        </Link>
        <Link href="/login">
          <Button variant="outline" size="lg">
            Sign in
          </Button>
        </Link>
      </div>
    </main>
  );
}
