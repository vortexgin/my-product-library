"use client";

import { useState, type FormEvent } from "react";
import { Table, type TableColumn, type TableRow } from "@/components/Table";
import { StatusBadge } from "@/components/StatusBadge";
import type { ProductUnit } from "@/app/product/models/ProductUnitModel";
import type { SessionInfo } from "@/libraries/Auth";
import { deleteEncrypted, getEncrypted } from "@/libraries/EncryptedFetch";

const API_PATH = "/product/api/v1/product-units";

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Name", field: "name" },
  { key: "symbol", label: "Symbol", field: "symbol" },
  { key: "status", label: "Status", field: "status" },
  { key: "created_at", label: "Created", field: "created_at" },
];

async function fetchProductUnitRows(params: URLSearchParams): Promise<TableRow[]> {
  let envelope;
  try {
    envelope = await getEncrypted<ProductUnit[]>(`${API_PATH}?${params.toString()}`);
  } catch {
    throw new Error("Something went wrong. Please try again.");
  }
  if (!envelope.success) {
    throw new Error(envelope.message || "Failed to fetch product units.");
  }
  return (envelope.data ?? []) as TableRow[];
}

async function deleteProductUnitRow(uuid: string): Promise<string> {
  try {
    const envelope = await deleteEncrypted<{ message: string }>(`${API_PATH}/${uuid}`);
    return envelope.success ? "" : envelope.message || "Failed to delete product unit.";
  } catch {
    return "Something went wrong. Please try again.";
  }
}

function renderProductUnitCell(column: TableColumn, row: TableRow, value: unknown) {
  if (column.key === "name") {
    return <span className="font-medium text-slate-900">{String(value ?? "—")}</span>;
  }
  if (column.key === "status") {
    return <StatusBadge status={String(value)} />;
  }
  if (column.key === "created_at") {
    return <span className="whitespace-nowrap">{new Date(String(value)).toLocaleString()}</span>;
  }
  return undefined;
}

export function ProductUnitTable({
  session,
}: {
  session: SessionInfo;
}) {
  const [draftQ, setDraftQ] = useState("");
  const [applied, setApplied] = useState<Record<string, string>>({});

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (draftQ.trim()) {
      next["filter[q]"] = draftQ.trim();
    }
    setApplied(next);
  }

  function resetFilters() {
    setDraftQ("");
    setApplied({});
  }

  return (
    <div>
      <form
        onSubmit={applyFilters}
        className="mt-6 flex flex-row gap-3"
      >
        <input
          type="search"
          value={draftQ}
          onChange={(event) => setDraftQ(event.target.value)}
          placeholder="Search name or symbol..."
          aria-label="Search product units"
          className="w-full flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Filter
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </form>

      <Table
        key={JSON.stringify(applied)}
        session={session}
        columns={COLUMNS}
        actionUpdate={["product:unit:view:update"]}
        actionDelete={["product:unit:view:delete"]}
        fetchRows={fetchProductUnitRows}
        basePath="/product/views/product-units"
        extraParams={applied}
        labelField="name"
        renderCell={renderProductUnitCell}
        onDelete={deleteProductUnitRow}
      />
    </div>
  );
}
