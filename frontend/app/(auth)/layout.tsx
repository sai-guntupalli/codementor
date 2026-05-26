export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="living-glow pointer-events-none absolute top-[-20%] left-[-10%] h-[60%] w-[60%]" aria-hidden />
      <div className="living-glow pointer-events-none absolute right-[-10%] bottom-[-20%] h-[60%] w-[60%]" aria-hidden />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}
