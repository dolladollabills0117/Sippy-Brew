"use client";
import { formatCents, MAX_QUANTITY_PER_LINE, resolveOptions, type MenuItem } from "@sippy/core";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, cx } from "./ui";

/**
 * Customize a drink before adding it: the shop's option groups (pick one / pick up to N,
 * required or not), each with the shop's price. The running price updates as options change.
 */
export function CustomizeDialog({
  item,
  onAdd,
  onClose,
}: {
  item: MenuItem;
  onAdd: (optionIds: string[], quantity: number) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resolved = resolveOptions(item.name, item.modifierGroups, picked);
  const extra = picked.reduce((sum, id) => {
    for (const g of item.modifierGroups) {
      const o = g.options.find((x) => x.id === id);
      if (o) return sum + o.priceCents;
    }
    return sum;
  }, 0);
  const unit = item.priceCents + extra;

  function toggle(groupId: string, optionId: string, single: boolean) {
    setError(null);
    const group = item.modifierGroups.find((g) => g.id === groupId)!;
    const inGroup = new Set(group.options.map((o) => o.id));
    setPicked((cur) => {
      if (cur.includes(optionId)) return cur.filter((x) => x !== optionId);
      if (single) return [...cur.filter((x) => !inGroup.has(x)), optionId];
      const count = cur.filter((x) => inGroup.has(x)).length;
      if (count >= group.maxSelect) return cur;
      return [...cur, optionId];
    });
  }

  function add() {
    if (!resolved.ok) return setError(resolved.message);
    onAdd(picked, quantity);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-espresso/40 sm:items-center" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[26px] bg-cream-swirl shadow-lift sm:rounded-[26px]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-latte px-5 py-4">
          <div>
            <h2 id="customize-title" className="text-2xl text-espresso">
              {item.name}
            </h2>
            <p className="text-sm text-pecan">
              {item.size} · {formatCents(item.priceCents, { showZeroCents: true })}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-2xl text-espresso hover:bg-latte">
            ×
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-4">
          {item.modifierGroups.map((g) => {
            const single = g.maxSelect === 1;
            return (
              <fieldset key={g.id} className="flex flex-col gap-2">
                <legend className="mb-1 flex w-full items-center justify-between font-extrabold text-espresso">
                  {g.name}
                  <span className="text-xs font-bold text-pecan">
                    {g.required ? "Required · " : ""}
                    {single ? "Pick one" : `Pick up to ${g.maxSelect}`}
                  </span>
                </legend>
                {g.options.map((o) => {
                  const checked = picked.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className={cx(
                        "flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-[14px] border-2 px-4",
                        checked ? "border-espresso bg-vanilla-bean" : "border-latte",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type={single ? "radio" : "checkbox"}
                          name={`g-${g.id}`}
                          checked={checked}
                          onChange={() => toggle(g.id, o.id, single)}
                          onClick={() => single && checked && toggle(g.id, o.id, single)}
                          className="h-5 w-5 accent-burnt-sugar"
                        />
                        <span className="text-espresso">{o.name}</span>
                      </span>
                      <span className="text-sm font-bold text-pecan">{o.priceCents ? `+${formatCents(o.priceCents, { showZeroCents: true })}` : "Free"}</span>
                    </label>
                  );
                })}
              </fieldset>
            );
          })}
          <p className="text-sm text-pecan">Customizations are priced by the shop. Your pass covers your order up to its daily max; anything more is an overage you confirm.</p>
        </div>

        <div className="flex flex-col gap-3 border-t border-latte px-5 py-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2" role="group" aria-label="Quantity">
              <Button size="sm" variant="secondary" aria-label="One fewer" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)}>
                −
              </Button>
              <span className="w-6 text-center text-lg font-extrabold tabular-nums" aria-live="polite">
                {quantity}
              </span>
              <Button size="sm" variant="secondary" aria-label="One more" disabled={quantity >= MAX_QUANTITY_PER_LINE} onClick={() => setQuantity((q) => q + 1)}>
                +
              </Button>
            </div>
            <span className="text-sm text-pecan">{formatCents(unit, { showZeroCents: true })} each</span>
          </div>
          <Button onClick={add}>Add to order · {formatCents(unit * quantity, { showZeroCents: true })}</Button>
        </div>
      </div>
    </div>
  );
}
