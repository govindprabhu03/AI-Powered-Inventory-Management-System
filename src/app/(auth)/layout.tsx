import Link from "next/link";

/**
 * Layout for the signed-out pages (login, signup, password reset).
 *
 * This exists because of the (auth) route group — the parentheses mean the
 * folder organises files without adding "/auth" to any URL. So /login and
 * /signup share this centred, chrome-free layout, while the dashboard gets a
 * completely different one with a sidebar.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 py-12">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        Smart Inventory
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
