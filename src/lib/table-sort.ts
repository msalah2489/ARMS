"use client";

import { useCallback, useMemo, useState } from "react";
import { isValidElement, type ReactNode } from "react";

export type SortDirection = "asc" | "desc";

export type ColumnSortState = {
  key: string | null;
  direction: SortDirection;
};

/** Compare cell values for table sorting (Arabic-aware, numeric when possible). */
export function compareSortValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  direction: SortDirection,
): number {
  const emptyA = a == null || a === "";
  const emptyB = b == null || b === "";
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  let result: number;
  if (typeof a === "number" && typeof b === "number") {
    result = a - b;
  } else {
    const sa = String(a).trim();
    const sb = String(b).trim();
    const na = Number(sa.replace(/,/g, ""));
    const nb = Number(sb.replace(/,/g, ""));
    const bothNumeric =
      sa !== "" &&
      sb !== "" &&
      Number.isFinite(na) &&
      Number.isFinite(nb) &&
      /^-?\d+(\.\d+)?$/.test(sa) &&
      /^-?\d+(\.\d+)?$/.test(sb);
    result = bothNumeric
      ? na - nb
      : sa.localeCompare(sb, "ar", { numeric: true, sensitivity: "base" });
  }
  return direction === "asc" ? result : -result;
}

/** Flatten React cell content into plain text for sorting. */
export function reactNodeToSortText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToSortText).join(" ");
  if (isValidElement(node)) {
    const props = node.props as {
      children?: ReactNode;
      "aria-label"?: string;
      title?: string;
    };
    if (props["aria-label"]?.trim()) return props["aria-label"].trim();
    if (props.title?.trim()) return props.title.trim();
    return reactNodeToSortText(props.children);
  }
  return "";
}

export function useColumnSort<T>(
  rows: T[],
  getValue: (row: T, columnKey: string) => string | number | null | undefined,
) {
  const [sort, setSort] = useState<ColumnSortState>({ key: null, direction: "asc" });

  const toggle = useCallback((key: string) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const key = sort.key;
    const direction = sort.direction;
    return [...rows].sort((a, b) =>
      compareSortValues(getValue(a, key), getValue(b, key), direction),
    );
  }, [rows, sort.key, sort.direction, getValue]);

  return {
    sorted,
    sortKey: sort.key,
    sortDirection: sort.direction,
    toggleSort: toggle,
  };
}
