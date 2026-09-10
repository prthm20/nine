// Timestamps render identically on the server and on the client: a fixed locale
// and an explicit UTC zone, so SSR output never disagrees with hydration (and
// two analysts in different offices quote the same time on the same finding).
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_SHORT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export function formatDateTime(value: Date | string | number): string {
  return `${DATE_TIME.format(new Date(value))} UTC`;
}

export function formatDate(value: Date | string | number): string {
  return DATE.format(new Date(value));
}

export function formatDateShort(value: Date | string | number): string {
  return DATE_SHORT.format(new Date(value));
}

export function toISO(value: Date | string | number): string {
  return new Date(value).toISOString();
}

/** Publisher shown beside a citation — "sec.gov" reads better than the URL. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
