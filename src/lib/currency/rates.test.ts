import { describe, expect, it, vi } from "vitest";

import {
  RATE_PROVIDERS,
  RateFetchError,
  availableCurrencies,
  convertCurrency,
  currencyName,
  fetchRates,
  formatMoney,
  isStale,
  type RateTable,
} from "./rates";

function table(over: Partial<RateTable> = {}): RateTable {
  return {
    base: "USD",
    rates: { USD: 1, PKR: 278.5, EUR: 0.92, GBP: 0.79 },
    fetchedAt: Date.UTC(2026, 0, 10),
    asOf: "2026-01-10",
    source: "test",
    ...over,
  };
}

/** A fetch that answers only the provider whose host appears in `answers`. */
function stubFetch(answers: Record<string, unknown>, status = 200): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.keys(answers).find((host) => url.includes(host));
    if (!match) throw new TypeError("network error");
    return new Response(JSON.stringify(answers[match]), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("fetchRates", () => {
  it("reads the primary provider and marks the base as worth one of itself", async () => {
    const result = await fetchRates("USD", {
      fetchImpl: stubFetch({
        "open.er-api.com": {
          rates: { PKR: 278.5, EUR: 0.92 },
          time_last_update_utc: "Sat, 10 Jan 2026 00:00:01 +0000",
        },
      }),
    });

    expect(result.source).toBe("open.er-api.com");
    expect(result.rates.PKR).toBe(278.5);
    expect(result.rates.USD).toBe(1);
    expect(result.asOf).toBe("2026-01-10");
  });

  it("falls back to the next provider when the first is unreachable", async () => {
    const result = await fetchRates("USD", {
      fetchImpl: stubFetch({
        "exchangerate.host": { rates: { PKR: 279 }, date: "2026-01-09" },
      }),
    });

    expect(result.source).toBe("exchangerate.host");
    expect(result.rates.PKR).toBe(279);
  });

  it("falls through a provider that answers with an error status", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("open.er-api.com")) return new Response("nope", { status: 429 });
      if (url.includes("exchangerate.host")) return new Response("nope", { status: 401 });
      return new Response(JSON.stringify({ rates: { EUR: 0.93 }, date: "2026-01-08" }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const result = await fetchRates("USD", { fetchImpl });
    expect(result.source).toBe("frankfurter.app");
  });

  it("rejects a malformed payload rather than caching nonsense", async () => {
    const result = await fetchRates("USD", {
      fetchImpl: stubFetch({
        "open.er-api.com": { rates: { PKR: "two hundred", EUR: null } },
        "exchangerate.host": { rates: { PKR: 279 }, date: "2026-01-09" },
      }),
    });

    expect(result.source).toBe("exchangerate.host");
  });

  it("reports every provider it tried when none answer", async () => {
    await expect(fetchRates("USD", { fetchImpl: stubFetch({}) })).rejects.toBeInstanceOf(
      RateFetchError,
    );

    try {
      await fetchRates("USD", { fetchImpl: stubFetch({}) });
    } catch (error) {
      expect((error as RateFetchError).attempts).toEqual(RATE_PROVIDERS.map((p) => p.id));
    }
  });

  it("asks for the base the caller wanted, upper-cased", async () => {
    const fetchImpl = stubFetch({ "open.er-api.com": { rates: { USD: 0.0036 } } });
    const result = await fetchRates("pkr", { fetchImpl });

    expect(result.base).toBe("PKR");
    expect(vi.mocked(fetchImpl).mock.calls[0][0]).toContain("/PKR");
  });
});

describe("convertCurrency", () => {
  it("converts through the base", () => {
    expect(convertCurrency(table(), "USD", "PKR", 10)).toBeCloseTo(2785, 8);
  });

  it("converts between two non-base currencies", () => {
    // 100 EUR is 100/0.92 USD, then times 278.5.
    expect(convertCurrency(table(), "EUR", "PKR", 100)).toBeCloseTo(30271.739130434, 6);
  });

  it("is an identity on the same currency", () => {
    expect(convertCurrency(table(), "GBP", "GBP", 42)).toBeCloseTo(42, 10);
  });

  it("accepts lower-case codes", () => {
    expect(convertCurrency(table(), "usd", "pkr", 1)).toBeCloseTo(278.5, 10);
  });

  it("returns null for a currency the table does not carry", () => {
    expect(convertCurrency(table(), "USD", "XYZ", 10)).toBeNull();
  });

  it("returns null rather than NaN for input that is not a number", () => {
    expect(convertCurrency(table(), "USD", "PKR", Number.NaN)).toBeNull();
  });
});

describe("isStale", () => {
  const fetchedAt = Date.UTC(2026, 0, 10, 12);

  it("is fresh within half a day", () => {
    expect(isStale(table({ fetchedAt }), fetchedAt + 60 * 60 * 1000)).toBe(false);
  });

  it("is stale after half a day, because rates publish daily", () => {
    expect(isStale(table({ fetchedAt }), fetchedAt + 13 * 60 * 60 * 1000)).toBe(true);
  });
});

describe("presentation helpers", () => {
  it("names the currencies students are most likely to want", () => {
    expect(currencyName("PKR")).toBe("Pakistani rupee");
    expect(currencyName("gbp")).toBe("Pound sterling");
  });

  it("falls back to the code for anything unlisted", () => {
    expect(currencyName("XPF")).toBe("XPF");
  });

  it("lists what the table can offer, sorted", () => {
    expect(availableCurrencies(table())).toEqual(["EUR", "GBP", "PKR", "USD"]);
    expect(availableCurrencies(undefined)).toEqual([]);
  });

  it("formats money without throwing on an unknown code", () => {
    expect(formatMoney(1234.5, "USD")).toContain("1,234.50");
    expect(formatMoney(1234.5, "ZZZ")).toContain("ZZZ");
    expect(formatMoney(Number.NaN, "USD")).toBe("—");
  });
});
