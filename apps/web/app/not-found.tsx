import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-10 text-center shadow-card">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">404</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-1 text-sm text-ink-2">
        That dossier or page does not exist, or it may have been removed.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex h-9 items-center rounded-md bg-accent px-3.5 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Back to portfolio
      </Link>
    </div>
  );
}
