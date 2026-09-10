import { ExternalLinkIcon } from "./Icons";
import { hostnameOf } from "@/lib/format";

/** Every figure in this product is traceable, so citations get a real affordance:
 *  publisher name up front, full URL on hover, external-link marker. */
export function SourceLink({ url, className = "" }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      title={url}
      className={`inline-flex max-w-full items-center gap-1 rounded text-accent underline decoration-from-font underline-offset-2 hover:no-underline ${className}`}
    >
      <span className="truncate">{hostnameOf(url)}</span>
      <ExternalLinkIcon className="h-3 w-3 shrink-0" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
