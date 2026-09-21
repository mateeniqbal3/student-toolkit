/**
 * Exchange rates.
 *
 * This is one of the few places outside the AI assistant that reaches the network, and it is worth
 * being precise about what that means: the request carries no user data, no
 * cookie and no identifier. It asks a public endpoint for a table of numbers.
 * Nothing about what the student is converting leaves the device.
 *
 * Three providers are tried in order, all free and none requiring an account
 * or a card, because the project has no budget and a currency converter that
 * dies when one service changes its terms is not worth building. Whatever
 * arrives is cached in IndexedDB, so the converter keeps working offline with
 * an honest "rates as of" date rather than failing.
 */

export interface RateTable {
  /** Currency every rate in the table is quoted against. */
  base: string;
  /** Code to units-per-base. Always contains the base itself, at 1. */
  rates: Record<string, number>;
  /** When this device fetched it, in epoch milliseconds. */
  fetchedAt: number;
  /** The date the provider says the rates are for, as an ISO date. */
  asOf: string;
  /** Which provider answered, shown in the UI so the number is traceable. */
  source: string;
}

interface Provider {
  id: string;
  label: string;
  url: (base: string) => string;
  parse: (payload: unknown, base: string) => { rates: Record<string, number>; asOf: string } | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** Keeps a malformed or partial payload from poisoning the cache. */
function readRates(value: unknown): Record<string, number> | null {
  const raw = asRecord(value);
  if (!raw) return null;

  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(raw)) {
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
      rates[code.toUpperCase()] = rate;
    }
  }
  return Object.keys(rates).length > 0 ? rates : null;
}

function isoDate(value: unknown, fallback: number): string {
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return new Date(fallback).toISOString().slice(0, 10);
}

/**
 * Order matters. The first provider is the one with the widest currency list:
 * the ECB-derived services are more authoritative but publish around thirty
 * currencies and omit PKR, INR and most of the ones this app's readers
 * actually need.
 */
export const RATE_PROVIDERS: readonly Provider[] = [
  {
    id: "open.er-api.com",
    label: "open.er-api.com",
    url: (base) => `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`,
    parse: (payload) => {
      const body = asRecord(payload);
      if (!body) return null;
      const rates = readRates(body.rates);
      if (!rates) return null;
      return { rates, asOf: isoDate(body.time_last_update_utc, Date.now()) };
    },
  },
  {
    id: "exchangerate.host",
    label: "exchangerate.host",
    url: (base) => `https://api.exchangerate.host/latest?base=${encodeURIComponent(base)}`,
    parse: (payload) => {
      const body = asRecord(payload);
      if (!body) return null;
      const rates = readRates(body.rates);
      if (!rates) return null;
      return { rates, asOf: isoDate(body.date, Date.now()) };
    },
  },
  {
    id: "frankfurter.app",
    label: "frankfurter.app",
    url: (base) => `https://api.frankfurter.app/latest?base=${encodeURIComponent(base)}`,
    parse: (payload) => {
      const body = asRecord(payload);
      if (!body) return null;
      const rates = readRates(body.rates);
      if (!rates) return null;
      return { rates, asOf: isoDate(body.date, Date.now()) };
    },
  },
];

export class RateFetchError extends Error {
  constructor(readonly attempts: string[]) {
    super("No exchange rate provider answered.");
    this.name = "RateFetchError";
  }
}

/**
 * Tries each provider until one answers with a usable table.
 *
 * Each attempt gets its own short timeout: a provider that hangs must not stop
 * the next one being tried, because the student is watching a spinner.
 */
export async function fetchRates(
  base: string,
  options: { signal?: AbortSignal; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<RateTable> {
  const { signal, timeoutMs = 8000, fetchImpl = fetch } = options;
  const code = base.toUpperCase();
  const attempted: string[] = [];

  for (const provider of RATE_PROVIDERS) {
    attempted.push(provider.id);
    try {
      const response = await fetchImpl(provider.url(code), {
        signal: signal ?? AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json" },
      });
      if (!response.ok) continue;

      const parsed = provider.parse(await response.json(), code);
      if (!parsed) continue;

      return {
        base: code,
        // The base is always worth one of itself; not every provider says so.
        rates: { ...parsed.rates, [code]: 1 },
        fetchedAt: Date.now(),
        asOf: parsed.asOf,
        source: provider.label,
      };
    } catch {
      // Offline, blocked, timed out, or the shape changed. Try the next one.
    }
  }

  throw new RateFetchError(attempted);
}

/** Rates are published once a working day, so refetching more often is waste. */
export const RATE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function isStale(table: RateTable, now = Date.now()): boolean {
  return now - table.fetchedAt > RATE_MAX_AGE_MS;
}

/**
 * Converts through the table's base, which is the only currency every rate is
 * expressed against.
 */
export function convertCurrency(
  table: RateTable,
  from: string,
  to: string,
  value: number,
): number | null {
  const fromRate = table.rates[from.toUpperCase()];
  const toRate = table.rates[to.toUpperCase()];

  if (!Number.isFinite(value) || !fromRate || !toRate || fromRate <= 0) return null;

  return (value / fromRate) * toRate;
}

/** Codes the table can offer, sorted so the list is predictable. */
export function availableCurrencies(table: RateTable | undefined): string[] {
  return table ? Object.keys(table.rates).sort() : [];
}

/**
 * Names for the currencies students are most likely to want. Anything not
 * listed falls back to its ISO code, which is still perfectly usable — this
 * map exists to make the common cases readable, not to be exhaustive.
 */
const CURRENCY_NAMES: Record<string, string> = {
  AED: "UAE dirham",
  AUD: "Australian dollar",
  BDT: "Bangladeshi taka",
  BRL: "Brazilian real",
  CAD: "Canadian dollar",
  CHF: "Swiss franc",
  CNY: "Chinese yuan",
  EGP: "Egyptian pound",
  EUR: "Euro",
  GBP: "Pound sterling",
  HKD: "Hong Kong dollar",
  IDR: "Indonesian rupiah",
  INR: "Indian rupee",
  IRR: "Iranian rial",
  JPY: "Japanese yen",
  KES: "Kenyan shilling",
  KRW: "South Korean won",
  LKR: "Sri Lankan rupee",
  MYR: "Malaysian ringgit",
  NGN: "Nigerian naira",
  NOK: "Norwegian krone",
  NPR: "Nepalese rupee",
  NZD: "New Zealand dollar",
  PKR: "Pakistani rupee",
  PHP: "Philippine peso",
  PLN: "Polish zloty",
  QAR: "Qatari riyal",
  RUB: "Russian rouble",
  SAR: "Saudi riyal",
  SEK: "Swedish krona",
  SGD: "Singapore dollar",
  THB: "Thai baht",
  TRY: "Turkish lira",
  USD: "US dollar",
  ZAR: "South African rand",
};

export function currencyName(code: string): string {
  return CURRENCY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

/** Shown first in the picker, because they are what gets converted most. */
export const POPULAR_CURRENCIES = ["USD", "EUR", "GBP", "PKR", "INR", "AED", "SAR", "CAD"];

export function formatMoney(value: number, code: string): string {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: Math.abs(value) < 1 ? 6 : 2,
    }).format(value);
  } catch {
    // An ISO code Intl does not know. Still worth showing the number.
    return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${code}`;
  }
}
