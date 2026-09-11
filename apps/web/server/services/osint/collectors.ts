import type { RiskCategory } from "../../config/riskWeights";

// ─────────────────────────────────────────────────────────────────────────────
// REAL OSINT COLLECTORS (keyless public sources)
//
//   reputational → Google News RSS: adverse media coverage (real article links)
//   legal        → CourtListener search API: US court records
//                  + legal-keyword news as a worldwide supplement
//   financial    → SEC EDGAR full-text search: NT 10-K/NT 10-Q late-filing
//                  notifications + financial-distress news coverage
//   cyber        → dns.google: missing SPF/DMARC records (email spoofing
//                  exposure) + crt.sh certificate-transparency lookups
//                  + breach/ransomware news coverage
//
// Every sourceUrl is a real, user-verifiable link. Each source fails soft
// (returns []) so one flaky upstream never sinks a dossier run. Sentiment and
// severity come from a documented keyword heuristic — swap scoreTone() for an
// AI scorer when per-signal AI budget is acceptable.
//
// (GDELT was evaluated for news but enforces one request per 5 seconds per IP,
// which can't support four parallel category queries per dossier run.)
//
// Caveat: name-based matching is only as precise as the name. "Acme" pulls
// every Acme on earth; prefer full legal names and set the domain for the
// cyber checks.
// ─────────────────────────────────────────────────────────────────────────────

export type CollectedSignal = {
  category: RiskCategory;
  type: string;
  title: string;
  detail: string;
  sourceUrl: string;
  sentiment: number; // -1 .. 1
  severity: number; // 0 .. 1
};

export type CompanyInput = { name: string; domain?: string | null };

/** Stable identity for a signal, used for snapshot diffing. */
export function signalKey(s: Pick<CollectedSignal, "type" | "title">): string {
  return `${s.type}:${s.title}`;
}

const FETCH_TIMEOUT_MS = 8_000;
const PER_SOURCE_LIMIT = 6;

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text) as T;
  } catch {
    return null; // timeouts, network errors, HTML error pages — all fail soft
  }
}

// ── Tone heuristic ───────────────────────────────────────────────────────────

const TONE_TERMS: [RegExp, number][] = [
  [/bankrupt|insolven|liquidat|default(s|ed|ing)? on/i, 0.9],
  [/fraud|scam|bribery|money launder|embezzle/i, 0.85],
  [/data breach|ransomware|hacked|cyber ?attack|data leak/i, 0.8],
  [/investigat|probe|regulator|subpoena/i, 0.7],
  [/fine(d)?|penalt|sanction/i, 0.65],
  [/lawsuit|sues|sued|litigation|class action/i, 0.6],
  [/recall|safety violation|contaminat/i, 0.55],
  [/layoff|job cuts|plant closure|shutdown/i, 0.5],
  [/scandal|controvers|boycott|protest|backlash/i, 0.5],
  [/loss(es)?|misses|downgrade|plunge|slump/i, 0.45],
];

function scoreTone(text: string): { severity: number; sentiment: number } {
  let severity = 0.3; // matched an adverse-keyword query but no strong term
  for (const [re, w] of TONE_TERMS) {
    if (re.test(text)) severity = Math.max(severity, w);
  }
  return { severity, sentiment: -(0.15 + severity * 0.75) };
}

// ── Google News RSS (news) ───────────────────────────────────────────────────

type NewsArticle = { url: string; title: string; date: string; publisher: string };

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

async function newsSearch(query: string): Promise<NewsArticle[]> {
  const url =
    "https://news.google.com/rss/search?" +
    new URLSearchParams({ q: query, hl: "en-US", gl: "US", ceid: "US:en" });
  let xml: string;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return [];
    xml = await res.text();
  } catch {
    return [];
  }

  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  for (const item of xml.split("<item>").slice(1)) {
    const title = decodeEntities(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const link = decodeEntities(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "");
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
    const publisher = decodeEntities(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "unknown source");
    const key = title.toLowerCase().replace(/\W+/g, " ").trim();
    if (!title || !link.startsWith("http") || seen.has(key)) continue;
    seen.add(key);
    const parsed = Date.parse(pubDate);
    articles.push({
      url: link,
      title,
      date: Number.isNaN(parsed) ? "" : new Date(parsed).toISOString().slice(0, 10),
      publisher,
    });
  }
  return articles;
}

function newsSignals(
  articles: NewsArticle[],
  companyName: string,
  category: RiskCategory,
  type: string,
  kind: string
): CollectedSignal[] {
  // Precision filter: keep articles that name the company in the headline.
  // Google's phrase match also returns body-text mentions, which for short or
  // common-word names ("boat", "apple") is mostly noise. If nothing passes
  // (name rarely appears verbatim in headlines), keep the originals rather
  // than dropping the category. Entity resolution proper (aliases, confidence
  // scores, review workflow) arrives with the watchlist feature.
  const nameRe = new RegExp(`\\b${companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const titled = articles.filter((a) => nameRe.test(a.title));
  const pool = titled.length > 0 ? titled : articles;
  return pool.slice(0, PER_SOURCE_LIMIT).map((a) => {
    const { severity, sentiment } = scoreTone(a.title);
    return {
      category,
      type,
      title: a.title,
      detail: `${kind} reported by ${a.publisher}${a.date ? ` on ${a.date}` : ""} (Google News index).`,
      sourceUrl: a.url,
      sentiment,
      severity,
    };
  });
}

async function collectReputational(name: string): Promise<CollectedSignal[]> {
  const articles = await newsSearch(
    `"${name}" (scandal OR fraud OR recall OR controversy OR investigation OR boycott)`
  );
  return newsSignals(articles, name, "reputational", "adverse_media", "Adverse media coverage");
}

// ── Legal: CourtListener + legal-news supplement ─────────────────────────────

type CourtListenerResult = {
  caseName?: string;
  court?: string;
  dateFiled?: string;
  docketNumber?: string;
  docket_absolute_url?: string;
  absolute_url?: string;
};

async function collectLegal(name: string): Promise<CollectedSignal[]> {
  const headers: Record<string, string> = {};
  if (process.env.COURTLISTENER_API_TOKEN) {
    headers.Authorization = `Token ${process.env.COURTLISTENER_API_TOKEN}`;
  }
  // Relevance order (the default) beats dateFiled here: a phrase query also
  // matches dockets that merely mention the company in a filing, and those
  // dominate recent-first ordering. Cases actually naming the company in the
  // caption are ranked first below.
  const url =
    "https://www.courtlistener.com/api/rest/v4/search/?" +
    new URLSearchParams({ q: `"${name}"`, type: "r" });
  const data = await fetchJson<{ results?: CourtListenerResult[] }>(url, headers);

  const results = (data?.results ?? []).filter((r) => r.caseName && (r.docket_absolute_url || r.absolute_url));
  // Adversarial captions naming the company ("Doe v. Acme Inc") outrank bare
  // name matches, which outrank dockets that only mention it in a filing —
  // people who share the company's name are the main noise source here.
  const rank = (r: CourtListenerResult) => {
    const caption = r.caseName!.toLowerCase();
    if (!caption.includes(name.toLowerCase())) return 0;
    return /\bv\.?\s/.test(caption) ? 2 : 1;
  };
  results.sort((a, b) => rank(b) - rank(a));

  const cases: CollectedSignal[] = results
    .slice(0, PER_SOURCE_LIMIT)
    .map((r) => ({
      category: "legal" as const,
      type: "litigation",
      title: r.caseName!,
      detail: `US court record${r.court ? ` (${r.court})` : ""}${r.dateFiled ? `, filed ${r.dateFiled}` : ""}${
        r.docketNumber ? `, docket ${r.docketNumber}` : ""
      }. Involvement type (plaintiff/defendant) requires review.`,
      sourceUrl: `https://www.courtlistener.com${r.docket_absolute_url ?? r.absolute_url}`,
      sentiment: -0.35,
      severity: 0.5,
    }));

  const articles = await newsSearch(`"${name}" (lawsuit OR "legal action" OR regulator OR tribunal OR indicted)`);
  return [...cases, ...newsSignals(articles, name, "legal", "legal_news", "Legal/regulatory news")];
}

// ── Financial: SEC EDGAR late filings + distress news ────────────────────────

type EdgarHit = {
  _id?: string;
  _source?: { ciks?: string[]; display_names?: string[]; file_date?: string; file_type?: string };
};

async function edgarLateFilings(name: string, form: "NT 10-K" | "NT 10-Q"): Promise<CollectedSignal[]> {
  // The endpoint 500s on comma-separated form lists, so query one form at a
  // time. SEC requires a declared User-Agent on programmatic access.
  const edgarUrl =
    "https://efts.sec.gov/LATEST/search-index?" + new URLSearchParams({ q: `"${name}"`, forms: form });
  const edgar = await fetchJson<{ hits?: { hits?: EdgarHit[] } }>(edgarUrl, {
    // `||`, not `??`: an env var set to "" must fall back to a valid
    // User-Agent rather than sending an empty header, which SEC rejects.
    "User-Agent": process.env.SEC_EDGAR_USER_AGENT || "CompanyRiskDossier research demo@dossier.local",
  });

  return (edgar?.hits?.hits ?? []).slice(0, PER_SOURCE_LIMIT).map((hit) => {
    const src = hit._source ?? {};
    const filer = src.display_names?.[0] ?? name;
    // _id is "<accession-number>:<primary-document>" — with the CIK that is
    // enough to build the direct document URL under /Archives.
    const [accession, doc] = (hit._id ?? "").split(":");
    const cik = src.ciks?.[0]?.replace(/^0+/, "");
    const directUrl =
      accession && doc && cik
        ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, "")}/${doc}`
        : `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${name}"`)}&forms=${encodeURIComponent(form)}`;
    return {
      category: "financial" as const,
      type: "filing_delay",
      title: `Late-filing notification (${src.file_type ?? form}) by ${filer}${src.file_date ? `, ${src.file_date}` : ""}`,
      detail: `SEC EDGAR records a notification of late filing${src.file_date ? ` dated ${src.file_date}` : ""}. Confirm the filer matches this company.`,
      sourceUrl: directUrl,
      sentiment: -0.5,
      severity: 0.6,
    };
  });
}

async function collectFinancial(name: string): Promise<CollectedSignal[]> {
  // NT 10-K / NT 10-Q = SEC notification that a filing will be late — a direct
  // filing-delay risk signal for US-listed companies.
  const [ntK, ntQ, articles] = await Promise.all([
    edgarLateFilings(name, "NT 10-K"),
    edgarLateFilings(name, "NT 10-Q"),
    newsSearch(`"${name}" (bankruptcy OR insolvency OR "debt default" OR downgrade OR "misses earnings" OR layoffs)`),
  ]);
  return [
    ...ntK,
    ...ntQ,
    ...newsSignals(articles, name, "financial", "financial_distress_news", "Financial-distress coverage"),
  ];
}

// ── Cyber: DNS hygiene + certificate transparency + breach news ──────────────

type DnsAnswer = { Status?: number; Answer?: { data?: string }[] };

async function dnsTxt(nameToResolve: string): Promise<string[]> {
  const data = await fetchJson<DnsAnswer>(
    `https://dns.google/resolve?${new URLSearchParams({ name: nameToResolve, type: "TXT" })}`
  );
  if (!data || data.Status !== 0) return [];
  return (data.Answer ?? []).map((a) => a.data ?? "").filter(Boolean);
}

/** Accepts "acme.com", "https://www.acme.com/path", etc. → "acme.com". */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const host = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .split(/[/?#]/)[0]
    .split(":")[0]
    .replace(/^www\./, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
}

async function collectCyber(name: string, rawDomain: string | null | undefined): Promise<CollectedSignal[]> {
  const signals: CollectedSignal[] = [];
  const domain = normalizeDomain(rawDomain);

  if (domain) {
    const [rootTxt, dmarcTxt] = await Promise.all([dnsTxt(domain), dnsTxt(`_dmarc.${domain}`)]);
    const hasSpf = rootTxt.some((t) => t.toLowerCase().includes("v=spf1"));
    const hasDmarc = dmarcTxt.some((t) => t.toLowerCase().includes("v=dmarc1"));

    if (!hasSpf) {
      signals.push({
        category: "cyber",
        type: "missing_spf",
        title: `No SPF record published for ${domain}`,
        detail: "Live DNS lookup found no SPF policy, leaving the domain easier to spoof in phishing campaigns.",
        sourceUrl: `https://dns.google/resolve?name=${domain}&type=TXT`,
        sentiment: -0.4,
        severity: 0.45,
      });
    }
    if (!hasDmarc) {
      signals.push({
        category: "cyber",
        type: "missing_dmarc",
        title: `No DMARC record published for ${domain}`,
        detail: "Live DNS lookup found no DMARC policy, so receivers cannot reject mail spoofed from this domain.",
        sourceUrl: `https://dns.google/resolve?name=_dmarc.${domain}&type=TXT`,
        sentiment: -0.45,
        severity: 0.5,
      });
    }

    // Certificate transparency: recent issuance volume is context for analysts
    // (infrastructure churn, shadow subdomains). crt.sh can be slow — fail soft.
    const certs = await fetchJson<{ id: number; not_before?: string }[]>(
      `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json&exclude=expired`
    );
    if (certs && certs.length > 0) {
      const ninetyDaysAgo = Date.now() - 90 * 86_400_000;
      const recent = certs.filter((c) => c.not_before && Date.parse(c.not_before) >= ninetyDaysAgo).length;
      signals.push({
        category: "cyber",
        type: "cert_activity",
        title: `${recent} TLS certificate(s) issued for ${domain} in the last 90 days`,
        detail: `Certificate-transparency logs list ${certs.length} unexpired certificate(s) for the domain; review for unexpected subdomains.`,
        sourceUrl: `https://crt.sh/?q=${encodeURIComponent(domain)}`,
        sentiment: -0.05,
        severity: 0.15,
      });
    }
  }

  const articles = await newsSearch(`"${name}" ("data breach" OR ransomware OR hacked OR cyberattack OR "data leak")`);
  return [...signals, ...newsSignals(articles, name, "cyber", "breach_news", "Cyber-incident coverage")];
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function collectSignals(company: CompanyInput): Promise<CollectedSignal[]> {
  const results = await Promise.allSettled([
    collectLegal(company.name),
    collectFinancial(company.name),
    collectCyber(company.name, company.domain),
    collectReputational(company.name),
  ]);

  const all: CollectedSignal[] = [];
  const seenUrls = new Set<string>();
  for (const r of results) {
    if (r.status !== "fulfilled") {
      console.error("OSINT collector failed:", r.reason);
      continue;
    }
    // Cross-category dedupe by URL — specific categories run first, so a breach
    // story lands under cyber rather than repeating under reputational.
    for (const s of r.value) {
      if (seenUrls.has(s.sourceUrl)) continue;
      seenUrls.add(s.sourceUrl);
      all.push(s);
    }
  }
  return all;
}
