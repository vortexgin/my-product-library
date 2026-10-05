"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PRODUCT_VARIANT_LIST_PATH } from "@/app/product/views/products/paths";
import type { Product } from "@/app/product/models/ProductModel";
import type { ProductVariant } from "@/app/product/models/ProductVariantModel";
import type { ProductMetadata } from "@/app/product/models/ProductMetadataModel";
import type { ProductMetadataField } from "@/app/product/models/ProductMetadataFieldModel";
import { AuthComponent } from "@/components/AuthComponent";
import { SelectField, TextField } from "@/components/FormField";
import { UploadButton } from "@/components/UploadButton";
import type { SessionInfo } from "@/libraries/Auth";
import { getEncrypted, postEncrypted, putEncrypted } from "@/libraries/EncryptedFetch";

const API_PATH = "/product/api/v1/product-variants";
const UPLOAD_PERMISSION = "base:tools:upload:upload";
const NEW_FIELD_VALUE = "__new__";

const rowLabelClass = "mb-1 block text-xs font-medium text-slate-600";
const rowInputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500";
const rowValueInputClass =
  "w-full min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500";

/**
 * Friendly degrade copy: raw API/transport messages go to the console, the UI
 * keeps human text (validator strings must never render as user copy).
 */
function logDegrade(scope: string, result: PromiseSettledResult<{ success: boolean; message: string }>) {
  if (result.status === "rejected") {
    console.error(`[product-variant-form] ${scope} failed:`, result.reason);
  } else if (!result.value.success && result.value.message) {
    console.error(`[product-variant-form] ${scope} failed:`, result.value.message);
  }
}

type MetadataRow = {
  key: string;
  uuid?: string;
  field_id: string;
  value: string;
  isNew: boolean;
  newName: string;
};

export type ProductVariantFormInitial = Partial<Pick<ProductVariant, "product_id" | "sku" | "name" | "price_override" | "status">> & {
  metadata?: Array<Pick<ProductMetadata, "uuid" | "product_metadata_field_id" | "value"> & { field_name?: string }>;
};

function newRow(): MetadataRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    field_id: "",
    value: "",
    isNew: false,
    newName: "",
  };
}

export function ProductVariantForm({
  mode,
  uuid,
  initial,
  session,
}: {
  mode: "create" | "edit";
  uuid?: string;
  initial?: ProductVariantFormInitial;
  session: SessionInfo;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [fields, setFields] = useState<ProductMetadataField[]>([]);
  const [productId, setProductId] = useState(initial?.product_id ?? "");
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [fieldsError, setFieldsError] = useState("");
  const [rows, setRows] = useState<MetadataRow[]>(() => {
    if (initial?.metadata && initial.metadata.length > 0) {
      return initial.metadata.map((item, index) => ({
        key: item.uuid ?? `initial-${index}-${Math.random().toString(36).slice(2)}`,
        uuid: item.uuid,
        field_id: item.product_metadata_field_id,
        value: item.value,
        isNew: false,
        newName: "",
      }));
    }
    return [];
  });

  const productItems =
    initial?.product_id && !products.some((option) => option.uuid === initial.product_id)
      ? [{ uuid: initial.product_id, sku: initial.product_id, name: initial.product_id } as Product, ...products]
      : products;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [productResult, fieldResult] = await Promise.allSettled([
          getEncrypted<Product[]>(`/product/api/v1/products?limit=100&sortProperty=name&sortDirection=asc`),
          getEncrypted<ProductMetadataField[]>(`/product/api/v1/product-metadata-fields?limit=100&sortProperty=name&sortDirection=asc`),
        ]);
        if (!active) {
          return;
        }
        if (productResult.status === "fulfilled" && productResult.value.success) {
          setProducts((productResult.value.data ?? []).filter((row) => row.status !== "deleted"));
        } else {
          logDegrade("products", productResult);
          setOptionsError("Failed to load products.");
        }
        if (fieldResult.status === "fulfilled" && fieldResult.value.success) {
          setFields((fieldResult.value.data ?? []).filter((row) => row.status !== "deleted"));
        } else {
          logDegrade("metadata-fields", fieldResult);
          setFieldsError("Failed to load metadata fields. You can still add a new field manually.");
        }
      } catch {
        if (active) {
          setOptionsError((current) => current || "Failed to load options. Please try again.");
          setFieldsError((current) => current || "Failed to load metadata fields. You can still add a new field manually.");
        }
      } finally {
        if (active) {
          setOptionsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function updateRow(key: string, patch: Partial<MetadataRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || optionsLoading) {
      return;
    }
    setError("");
    setIsPending(true);
    try {
      const formData = new FormData(event.currentTarget);
      const overrideRaw = String(formData.get("price_override") ?? "").trim();
      const payload: Record<string, unknown> = {
        sku: String(formData.get("sku") ?? ""),
        name: String(formData.get("name") ?? ""),
        price_override: overrideRaw === "" ? null : Number(overrideRaw),
        status: String(formData.get("status") ?? "active"),
      };
      if (mode === "create") {
        payload.product_id = productId;
      }
      if (typeof payload.price_override === "number" && Number.isNaN(payload.price_override)) {
        setError("Price override must be a number.");
        setIsPending(false);
        return;
      }

      // Omission = delete within this variant's scope (rows left out are
      // soft-deleted server-side).
      const metadata = rows
        .map((row) => {
          const value = row.value.trim();
          if (!value) {
            return null;
          }
          if (row.isNew) {
            const name = row.newName.trim();
            if (!name) {
              return { invalid: true };
            }
            return { field_name: name, value, ...(row.uuid ? { uuid: row.uuid } : {}) };
          }
          if (!row.field_id) {
            return { invalid: true };
          }
          return {
            product_metadata_field_id: row.field_id,
            value,
            ...(row.uuid ? { uuid: row.uuid } : {}),
          };
        })
        .filter(Boolean) as Record<string, unknown>[];

      if (metadata.some((item) => (item as Record<string, unknown>).invalid)) {
        setError("Each metadata row needs a field (or a new field name) and a value.");
        setIsPending(false);
        return;
      }
      (payload as Record<string, unknown>).metadata = metadata;

      const envelope =
        mode === "create"
          ? await postEncrypted<ProductVariant>(API_PATH, payload)
          : await putEncrypted<ProductVariant>(`${API_PATH}/${uuid}`, payload);

      if (!envelope.success) {
        setError(envelope.message || `Failed to ${mode === "create" ? "create" : "update"} product variant.`);
        return;
      }
      router.push(PRODUCT_VARIANT_LIST_PATH);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">
          {mode === "create" ? "New product variant" : "Edit product variant"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {mode === "create" ? "Create product variant." : "Update product variant."}
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {mode === "create" ? (
            <SelectField
              label="Product"
              name="product_id"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              disabled={optionsLoading}
              options={productItems.map((option) => ({ value: option.uuid, label: `${option.name} · ${option.sku}` }))}
              placeholder={optionsLoading ? "Loading products..." : "Select product..."}
            />
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="SKU" name="sku" required minLength={2} defaultValue={initial?.sku ?? ""} placeholder="e.g. PRD-001-RED" hint="Stored uppercase; unique per organization." />
            <TextField label="Name" name="name" required minLength={2} defaultValue={initial?.name ?? ""} placeholder="e.g. Red / XL" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Price override"
              name="price_override"
              type="number"
              min={0}
              step={1}
              defaultValue={typeof initial?.price_override === "number" ? initial.price_override : ""}
              placeholder="Empty = base price"
              hint="Empty resolves to the product base price."
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
          </div>

          {optionsError ? (
            <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {optionsError}
            </p>
          ) : null}

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Variant metadata</h2>
                <p className="mt-0.5 text-xs text-slate-500">Rows here belong to this variant only.</p>
                {fieldsError ? (
                  <p role="alert" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {fieldsError}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setRows((current) => [...current, newRow()])}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Add row
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {rows.map((row, index) => (
                <div key={row.key} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <div>
                    <SelectField
                      label={`Field #${index + 1}`}
                      value={row.isNew ? NEW_FIELD_VALUE : row.field_id}
                      onChange={(event) => {
                        const selected = event.target.value;
                        if (selected === NEW_FIELD_VALUE) {
                          updateRow(row.key, { isNew: true, field_id: "", newName: "" });
                        } else {
                          updateRow(row.key, { isNew: false, field_id: selected, newName: "" });
                        }
                      }}
                      options={[
                        ...fields.map((field) => ({ value: field.uuid, label: field.name })),
                        { value: NEW_FIELD_VALUE, label: "+ Add new field..." },
                      ]}
                      placeholder="Select field..."
                      labelClassName={rowLabelClass}
                      className={rowInputClass}
                    />
                    {row.isNew ? (
                      <div className="mt-2">
                        <TextField
                          value={row.newName}
                          onChange={(event) => updateRow(row.key, { newName: event.target.value })}
                          placeholder="New field name, e.g. Size"
                          className={rowInputClass}
                        />
                      </div>
                    ) : null}
                  </div>
                  <TextField
                    label="Value"
                    value={row.value}
                    onChange={(event) => updateRow(row.key, { value: event.target.value })}
                    placeholder="Field value"
                    labelClassName={rowLabelClass}
                    className={rowValueInputClass}
                    action={
                      <AuthComponent
                        user={session.user}
                        permissions={session.permissions}
                        allowedPermissions={[UPLOAD_PERMISSION]}
                      >
                        <UploadButton
                          onUploaded={(url) => updateRow(row.key, { value: url })}
                          onError={setError}
                        />
                      </AuthComponent>
                    }
                  />
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Remove metadata row ${index + 1}`}
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending || (mode === "create" && optionsLoading)}
              className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isPending ? "Saving..." : mode === "create" ? "Create product variant" : "Save changes"}
            </button>
            <Link
              href={PRODUCT_VARIANT_LIST_PATH}
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
