"use client";

import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";

import { CurrencyPanel } from "@/components/units/currency-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  CURRENCY_CATEGORY_ID,
  UNIT_CATEGORIES,
  getCategory,
  type UnitCategory,
} from "@/lib/units/categories";
import { convert, convertToAll, formatQuantity, isBelowAbsoluteZero } from "@/lib/units/convert";

const CATEGORY_STORAGE_KEY = "toolkit:units:category";

export function UnitConverter() {
  const [categoryId, setCategoryId] = useLocalStorage(CATEGORY_STORAGE_KEY, "length");
  const category = getCategory(categoryId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="unit-category" className="font-display font-semibold">
          What are you converting?
        </Label>
        <NativeSelect
          id="unit-category"
          className="h-9 w-full sm:w-72"
          value={category ? categoryId : CURRENCY_CATEGORY_ID}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          {UNIT_CATEGORIES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
          <option value={CURRENCY_CATEGORY_ID}>Currency</option>
        </NativeSelect>
      </div>

      {/* Remounting on category change is what resets the unit pair to that
          category's sensible default, rather than leaving "kilometres" selected
          on a screen that is now about pressure. */}
      {category ? (
        <CategoryPanel key={category.id} category={category} />
      ) : (
        <CurrencyPanel key="currency" />
      )}
    </div>
  );
}

function CategoryPanel({ category }: { category: UnitCategory }) {
  const [from, setFrom] = useState(category.defaults[0]);
  const [to, setTo] = useState(category.defaults[1]);
  const [raw, setRaw] = useState("1");

  const value = Number(raw);
  const entered = raw.trim() !== "" && Number.isFinite(value);
  const result = entered ? convert(category, from, to, value) : null;
  const impossible = entered && isBelowAbsoluteZero(category, from, value);
  const all = entered && !impossible ? convertToAll(category, from, value) : [];

  const fromUnit = category.units.find((unit) => unit.id === from);
  const toUnit = category.units.find((unit) => unit.id === to);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="unit-value" className="text-muted-foreground text-xs">
            Amount
          </Label>
          <Input
            id="unit-value"
            className="h-9"
            type="number"
            inputMode="decimal"
            step="any"
            value={raw}
            onChange={(event) => setRaw(event.target.value)}
          />
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="unit-from" className="text-muted-foreground text-xs">
            From
          </Label>
          <NativeSelect
            id="unit-from"
            className="h-9"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          >
            {category.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({unit.symbol})
              </option>
            ))}
          </NativeSelect>
        </div>

        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0 self-end"
          aria-label="Swap the two units"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          <ArrowLeftRight className="size-4" aria-hidden />
        </Button>

        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="unit-to" className="text-muted-foreground text-xs">
            To
          </Label>
          <NativeSelect
            id="unit-to"
            className="h-9"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          >
            {category.units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} ({unit.symbol})
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <section
        aria-label="Result"
        className="bg-card ring-foreground/10 flex flex-col gap-1 rounded-xl p-4 ring-1"
      >
        {impossible ? (
          <p className="text-destructive text-sm text-pretty" role="alert">
            Nothing is colder than absolute zero, so there is no temperature to convert.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {entered ? `${formatQuantity(value)} ${fromUnit?.symbol ?? ""}` : "Enter an amount"}
            </p>
            <p
              className="font-display text-primary text-3xl font-semibold tabular-nums"
              aria-live="polite"
            >
              {result === null ? "—" : formatQuantity(result)}
              <span className="text-muted-foreground ms-2 text-base font-normal">
                {toUnit?.symbol}
              </span>
            </p>
          </>
        )}
      </section>

      {all.length > 0 ? (
        <section aria-labelledby="all-units-heading" className="flex flex-col gap-2">
          <h2 id="all-units-heading" className="font-display text-sm font-semibold">
            Every {category.name.toLowerCase()} unit
          </h2>
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {all.map((row) => (
              <li
                key={row.unit.id}
                className="border-border flex items-baseline justify-between gap-3 border-b py-1.5 text-sm"
              >
                <span className="text-muted-foreground">{row.unit.name}</span>
                <span className="tabular-nums">
                  {formatQuantity(row.value)}{" "}
                  <span className="text-muted-foreground">{row.unit.symbol}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
