"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PRODUCT_UNIT_LIST_PATH } from "@/app/product/views/products/paths";
import type { ProductUnit } from "@/app/product/models/ProductUnitModel";
import { postEncrypted, putEncrypted } from "@/libraries/EncryptedFetch";
import { SelectField, TextField } from "@/components/FormField";

const API_PATH = "/product/api/v1/product-units";

export function ProductUnitForm({
  mode,
  uuid,
  initial,
}: {
  mode: "create" | "edit";
  uuid?: string;
  initial?: Pick<ProductUnit, "name" | "symbol" | "status">;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const formData = new FormData(event.currentTarget);
      const payload: Record<string, unknown> = {
        name: String(formData.get("name") ?? ""),
        symbol: String(formData.get("symbol") ?? ""),
        status: String(formData.get("status") ?? "active"),
      };

      const envelope =
        mode === "create"
          ? await postEncrypted<ProductUnit>(API_PATH, payload)
          : await putEncrypted<ProductUnit>(`${API_PATH}/${uuid}`, payload);

      if (!envelope.success) {
        setError(envelope.message || `Failed to ${mode === "create" ? "create" : "update"} product unit.`);
        return;
      }

      router.push(PRODUCT_UNIT_LIST_PATH);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
          {mode === "create" ? "New product unit" : "Edit product unit"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {mode === "create" ? "Create product unit." : "Update product unit."}
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <TextField
            label="Name"
            type="text"
            name="name"
            required
            minLength={1}
            defaultValue={initial?.name ?? ""}
            placeholder="e.g. Pieces"
          />

          <TextField
            label="Symbol"
            type="text"
            name="symbol"
            required
            minLength={1}
            defaultValue={initial?.symbol ?? ""}
            placeholder="e.g. pcs"
          />

          <SelectField
            label="Status"
            name="status"
            defaultValue={initial?.status ?? "active"}
            options={[
              { value: "active", label: "active" },
              { value: "inactive", label: "inactive" },
            ]}
          />

          {error ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isPending ? "Saving..." : mode === "create" ? "Create product unit" : "Save changes"}
            </button>
            <Link
              href={PRODUCT_UNIT_LIST_PATH}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
