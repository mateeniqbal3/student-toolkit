"use client";

import { ArrowLeftRight, RefreshCw, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { loadRates, type RateLoad } from "@/lib/db/currency";
import {
  POPULAR_CURRENCIES,
  availableCurrencies,
  convertCurrency,
  currencyName,
  formatMoney,
} from "@/lib/currency/rates";

/**
 * Rates are always fetched against one base and converted through it, so the
 * cache holds a single table however many currency pairs get used.
 */
const BASE = "USD";

export function CurrencyPanel() {
  const [load, setLoad] = useState<RateLoad | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("PKR");
  const [raw, setRaw] = useState("100");

  useEffect(() => {
    let active = true;
    void loadRates(BASE).then((next) => {
      if (active) setLoad(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const table = load?.table;
  const codes = useMemo(() => orderCurrencies(availableCurrencies(table)), [table]);

  const value = Number(raw);
  const entered = raw.trim() !== "" && Number.isFinite(value);
  const result = table && entered ? convertCurrency(table, from, to, value) : null;
  const unitRate = table ? convertCurrency(table, from, to, 1) : null;

  async function refresh() {
    setRefreshing(true);
    const next = await loadRates(BASE, true);
    setLoad(next);
    setRefreshing(false);
  }

  if (load === null) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <span className="sr-only">Loading exchange rates</span>
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {load.error ? (
        <p
          role="status"
          className="text-muted-foreground flex items-start gap-2 text-sm text-pretty"
        >
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          {load.error}
        </p>
      ) : null}

      {table ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="currency-value" className="text-muted-foreground text-xs">
                Amount
              </Label>
              <Input
                id="currency-value"
                className="h-9"
                type="number"
                inputMode="decimal"
                step="any"
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
              />
            </div>

            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="currency-from" className="text-muted-foreground text-xs">
                From
              </Label>
              <CurrencySelect
                id="currency-from"
                codes={codes}
                value={from}
                onChange={setFrom}
                label="Convert from"
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0 self-end"
              aria-label="Swap the two currencies"
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
            >
              <ArrowLeftRight className="size-4" aria-hidden />
            </Button>

            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="currency-to" className="text-muted-foreground text-xs">
                To
              </Label>
              <CurrencySelect
                id="currency-to"
                codes={codes}
                value={to}
                onChange={setTo}
                label="Convert to"
              />
            </div>
          </div>

          <section
            aria-label="Converted amount"
            className="bg-card ring-foreground/10 flex flex-col gap-1 rounded-xl p-4 ring-1"
          >
            <p className="text-muted-foreground text-sm">
              {entered ? formatMoney(value, from) : "Enter an amount"}
            </p>
            <p
              className="font-display text-primary text-3xl font-semibold tabular-nums"
              aria-live="polite"
            >
              {result === null ? "—" : formatMoney(result, to)}
            </p>
            {unitRate !== null ? (
              <p className="text-muted-foreground text-sm tabular-nums">
                1 {from} = {formatMoney(unitRate, to)}
              </p>
            ) : null}
          </section>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
            <span>
              Rates as of {table.asOf}, from {table.source}.
            </span>
            <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
              {refreshing ? "Refreshing" : "Refresh"}
            </Button>
          </div>
        </>
      ) : (
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
}

function CurrencySelect({
  id,
  codes,
  value,
  onChange,
  label,
}: {
  id: string;
  codes: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  // A currency the provider did not send would otherwise leave the select
  // showing the first option while the state says something else.
  const known = codes.includes(value);

  return (
    <NativeSelect
      id={id}
      aria-label={label}
      className="h-9"
      value={known ? value : (codes[0] ?? "")}
      onChange={(event) => onChange(event.target.value)}
    >
      {codes.map((code) => (
        <option key={code} value={code}>
          {code} — {currencyName(code)}
        </option>
      ))}
    </NativeSelect>
  );
}

/** The handful students actually convert, then everything else alphabetically. */
function orderCurrencies(codes: string[]): string[] {
  const popular = POPULAR_CURRENCIES.filter((code) => codes.includes(code));
  const rest = codes.filter((code) => !popular.includes(code));
  return [...popular, ...rest];
}
