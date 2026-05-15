import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="text-4xl font-bold tracking-tight text-foreground">
        CodeMentor
      </h1>
      <p className="mt-4 text-muted-foreground">
        Your adaptive coding learning platform.
      </p>
      <Button className="mt-8" size="lg">
        Get Started
      </Button>
    </main>
  );
}
