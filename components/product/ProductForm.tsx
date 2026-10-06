"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PRODUCT_LIST_PATH } from "@/app/product/views/products/paths";
import type { Product, ProductBomLine } from "@/app/product/models/ProductModel";
import type { ProductVariant } from "@/app/product/models/ProductVariantModel";
import type { ProductMetadata } from "@/app/product/models/ProductMetadataModel";
import type { ProductMetadataField } from "@/app/product/models/ProductMetadataFieldModel";
import type { ProductCategory } from "@/app/product/models/ProductCategoryModel";
import type { ProductUnit } from "@/app/product/models/ProductUnitModel";
import { AuthComponent } from "@/components/AuthComponent";
import { SelectField, TextAreaField, TextField } from "@/components/FormField";
import { UploadButton } from "@/components/UploadButton";
import type { SessionInfo } from "@/libraries/Auth";
import { getEncrypted, postEncrypted, putEncrypted } from "@/libraries/EncryptedFetch";

const API_PATH = "/product/api/v1/products";
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
    console.error(`[product-form] ${scope} failed:`, result.reason);
  } else if (!result.value.success && result.value.message) {
    console.error(`[product-form] ${scope} failed:`, result.value.message);
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

export type ProductFormInitial = Partial<Pick<Product, "sku" | "name" | "description" | "category_id" | "unit_id" | "base_price" | "status">> & {
  metadata?: Array<Pick<ProductMetadata, "uuid" | "product_metadata_field_id" | "value"> & { field_name?: string }>;
  bom?: Array<Pick<ProductBomLine, "uuid" | "variant_id" | "component_product_id" | "component_variant_id" | "qty">>;
};

type BomRow = {
  key: string;
  uuid?: string;
  component_product_id: string;
  component_variant_id: string;
  variant_id: string;
  qty: string;
};

function newBomRow(): BomRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    component_product_id: "",
    component_variant_id: "",
    variant_id: "",
    qty: "1",
  };
}

function newRow(): MetadataRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    field_id: "",
    value: "",
    isNew: false,
    newName: "",
  };
}

export function ProductForm({
  mode,
  uuid,
  initial,
  session,
}: {
  mode: "create" | "edit";
  uuid?: string;
  initial?: ProductFormInitial;
  session: SessionInfo;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [fields, setFields] = useState<ProductMetadataField[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allVariants, setAllVariants] = useState<ProductVariant[]>([]);
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [unitId, setUnitId] = useState(initial?.unit_id ?? "");
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState("");
  const [fieldsError, setFieldsError] = useState("");
  const [bomError, setBomError] = useState("");
  const [bomRows, setBomRows] = useState<BomRow[]>(() => {
    if (initial?.bom && initial.bom.length > 0) {
      return initial.bom.map((item, index) => ({
        key: item.uuid ?? `initial-bom-${index}-${Math.random().toString(36).slice(2)}`,
        uuid: item.uuid,
        component_product_id: item.component_product_id,
        component_variant_id: item.component_variant_id ?? "",
        variant_id: item.variant_id ?? "",
        qty: String(item.qty),
      }));
    }
    return [];
  });
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
    return [newRow()];
  });

  // Keep current selections when missing from fetched lists.
  const categoryItems =
    initial?.category_id && !categories.some((option) => option.uuid === initial.category_id)
      ? [{ uuid: initial.category_id, name: initial.category_id } as ProductCategory, ...categories]
      : categories;
  const unitItems =
    initial?.unit_id && !units.some((option) => option.uuid === initial.unit_id)
      ? [{ uuid: initial.unit_id, name: initial.unit_id, symbol: "" } as ProductUnit, ...units]
      : units;

  // Component dropdown excludes this product (self-reference is rejected server-side).
  // Search filters are display-only: submit builds from full bomRows state, never the filtered view.
  const [bomFilter, setBomFilter] = useState("");
  const componentItems = products.filter((option) => option.uuid !== uuid);
  const visibleComponentItems = componentItems.filter((option) =>
    `${option.sku} ${option.name}`.toLowerCase().includes(bomFilter.trim().toLowerCase()),
  );
  // Scope dropdown = this product's own variants (edit mode only; create has none yet).
  const scopeVariantItems = allVariants.filter((variant) => uuid && variant.product_id === uuid);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Independent degrade: one dropdown failing must not block the others.
        const [categoryResult, unitResult, fieldResult, productResult, variantResult] = await Promise.allSettled([
          getEncrypted<ProductCategory[]>(`/product/api/v1/product-categories?limit=100&sortProperty=name&sortDirection=asc`),
          getEncrypted<ProductUnit[]>(`/product/api/v1/product-units?limit=100&sortProperty=name&sortDirection=asc`),
          getEncrypted<ProductMetadataField[]>(`/product/api/v1/product-metadata-fields?limit=100&sortProperty=name&sortDirection=asc`),
          getEncrypted<Product[]>(`/product/api/v1/products?limit=100&sortProperty=name&sortDirection=asc`),
          getEncrypted<ProductVariant[]>(`/product/api/v1/product-variants?limit=100&sortProperty=name&sortDirection=asc`),
        ]);
        if (!active) {
          return;
        }
        if (categoryResult.status === "fulfilled" && categoryResult.value.success) {
          setCategories((categoryResult.value.data ?? []).filter((row) => row.status !== "deleted"));
        } else {
          logDegrade("categories", categoryResult);
          setOptionsError("Failed to load categories.");
        }
        if (unitResult.status === "fulfilled" && unitResult.value.success) {
          setUnits((unitResult.value.data ?? []).filter((row) => row.status !== "deleted"));
        } else {
          logDegrade("units", unitResult);
          setOptionsError("Failed to load units. A pcs unit is auto-created on save when left empty.");
        }
        if (fieldResult.status === "fulfilled" && fieldResult.value.success) {
          setFields((fieldResult.value.data ?? []).filter((row) => row.status !== "deleted"));
        } else {
          logDegrade("metadata-fields", fieldResult);
          setFieldsError("Failed to load metadata fields. You can still add a new field manually.");
        }
        if (productResult.status === "fulfilled" && productResult.value.success) {
          setProducts((productResult.value.data ?? []).filter((row) => row.status !== "deleted"));
        } else {
          logDegrade("bom-products", productResult);
          setBomError("Failed to load products for the bill of materials.");
        }
        if (variantResult.status === "fulfilled" && variantResult.value.success) {
          setAllVariants((variantResult.value.data ?? []).filter((row) => row.status !== "deleted"));
        } else {
          logDegrade("bom-variants", variantResult);
          setBomError("Failed to load variants for the bill of materials.");
        }
      } catch {
        if (active) {
          setOptionsError((current) => current || "Failed to load options. Please try again.");
          setFieldsError((current) => current || "Failed to load metadata fields. You can still add a new field manually.");
          setBomError((current) => current || "Failed to load products for the bill of materials.");
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

  function updateBomRow(key: string, patch: Partial<BomRow>) {
    setBomRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeBomRow(key: string) {
    setBomRows((current) => current.filter((row) => row.key !== key));
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
      const basePriceRaw = String(formData.get("base_price") ?? "").trim();
      const payload: Record<string, unknown> = {
        sku: String(formData.get("sku") ?? ""),
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? "").trim() || null,
        category_id: categoryId || null,
        unit_id: unitId || null,
        base_price: basePriceRaw === "" ? undefined : Number(basePriceRaw),
        status: String(formData.get("status") ?? "active"),
      };
      if (typeof payload.base_price === "number" && Number.isNaN(payload.base_price)) {
        setError("Base price must be a number.");
        setIsPending(false);
        return;
      }

      // Omission = delete: full-replacement sync soft-deletes product-level
      // rows left out of this payload (sending metadata: [] deletes all).
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

      // Omission = delete: full-replacement BoM sync soft-deletes rows left
      // out of this payload (sending bom: [] deletes all).
      const bom = bomRows.map((row) => {
        if (!row.component_product_id) {
          return { invalid: true };
        }
        if (uuid && row.component_product_id === uuid) {
          return { invalid: true };
        }
        const qty = Number.parseInt(row.qty, 10);
        if (!Number.isInteger(qty) || qty < 1) {
          return { invalid: true };
        }
        return {
          ...(row.uuid ? { uuid: row.uuid } : {}),
          component_product_id: row.component_product_id,
          component_variant_id: row.component_variant_id || null,
          variant_id: row.variant_id || null,
          qty,
        };
      });

      if (bom.some((item) => (item as Record<string, unknown>).invalid)) {
        setError("Each bill-of-materials row needs a component (not this product) and qty ≥ 1.");
        setIsPending(false);
        return;
      }
      (payload as Record<string, unknown>).bom = bom;

      const envelope =
        mode === "create"
          ? await postEncrypted<Product>(API_PATH, payload)
          : await putEncrypted<Product>(`${API_PATH}/${uuid}`, payload);

      if (!envelope.success) {
        setError(envelope.message || `Failed to ${mode === "create" ? "create" : "update"} product.`);
        return;
      }
      router.push(mode === "create" ? PRODUCT_LIST_PATH : `${PRODUCT_LIST_PATH}/${uuid}`);
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
          {mode === "create" ? "New product" : "Edit product"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {mode === "create" ? "Create product." : "Update product."}
        </h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField label="SKU" name="sku" required minLength={2} defaultValue={initial?.sku ?? ""} placeholder="e.g. PRD-001" hint="Stored uppercase; unique per organization." />
            <TextField label="Name" name="name" required minLength={2} defaultValue={initial?.name ?? ""} placeholder="e.g. Coffee Beans 1kg" />
          </div>

          <TextAreaField label="Description" name="description" rows={3} defaultValue={initial?.description ?? ""} placeholder="Sellable description..." />

          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label="Category"
              name="category_id"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={optionsLoading}
              options={categoryItems.map((option) => ({ value: option.uuid, label: option.name }))}
              placeholder={optionsLoading ? "Loading categories..." : "— No category —"}
            />
            <SelectField
              label="Unit"
              name="unit_id"
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
              disabled={optionsLoading}
              options={unitItems.map((option) => ({
                value: option.uuid,
                label: option.symbol ? `${option.name} (${option.symbol})` : option.name,
              }))}
              placeholder={optionsLoading ? "Loading units..." : "— Auto pcs —"}
              hint="Empty assigns the org pcs unit on save."
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Base price"
              name="base_price"
              type="number"
              required={mode === "create"}
              min={0}
              step={1}
              defaultValue={typeof initial?.base_price === "number" ? initial.base_price : ""}
              placeholder="0"
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
                <h2 className="text-sm font-semibold text-slate-900">Product metadata</h2>
                <p className="mt-0.5 text-xs text-slate-500">Pick a field from the dropdown or add a new one on the fly.</p>
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
                          placeholder="New field name, e.g. Color"
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

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Bill of materials</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  What this product is made of. Issuing this product consumes components automatically.
                </p>
                {bomError ? (
                  <p role="alert" className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {bomError}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setBomRows((current) => [...current, newBomRow()])}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Add component
              </button>
            </div>
            <div className="mt-3">
              <TextField
                value={bomFilter}
                onChange={(event) => setBomFilter(event.target.value)}
                placeholder="Filter components..."
                aria-label="Filter component products"
                className={rowInputClass}
              />
            </div>
            {bomRows.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">No components. This product is stocked directly.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {bomRows.map((row, index) => {
                  const componentVariants = allVariants.filter(
                    (variant) => variant.product_id === row.component_product_id,
                  );
                  const componentLabel = (id: string) => {
                    const found = products.find((option) => option.uuid === id);
                    return found ? `${found.sku} · ${found.name}` : id;
                  };
                  return (
                    <div key={row.key} className="grid gap-2 rounded-xl bg-slate-50 p-3">
                      <SelectField
                        label={`Component #${index + 1}`}
                        value={row.component_product_id}
                        onChange={(event) =>
                          updateBomRow(row.key, {
                            component_product_id: event.target.value,
                            component_variant_id: "",
                          })
                        }
                        disabled={optionsLoading}
                        options={[
                          ...visibleComponentItems.map((option) => ({
                            value: option.uuid,
                            label: `${option.sku} · ${option.name}`,
                          })),
                          ...(row.component_product_id &&
                          !componentItems.some((option) => option.uuid === row.component_product_id)
                            ? [{ value: row.component_product_id, label: componentLabel(row.component_product_id) }]
                            : []),
                        ]}
                        placeholder={optionsLoading ? "Loading products..." : "Select component..."}
                        labelClassName={rowLabelClass}
                        className={rowInputClass}
                      />
                      <div className="grid gap-2 sm:grid-cols-3">
                        <SelectField
                          label="For variant"
                          value={row.variant_id}
                          onChange={(event) => updateBomRow(row.key, { variant_id: event.target.value })}
                          disabled={optionsLoading || mode === "create"}
                          options={scopeVariantItems.map((option) => ({
                            value: option.uuid,
                            label: `${option.sku} · ${option.name}`,
                          }))}
                          placeholder="— All variants —"
                          hint={mode === "create" ? "Save first, then scope by variant." : undefined}
                          labelClassName={rowLabelClass}
                          className={rowInputClass}
                        />
                        <SelectField
                          label="Component variant"
                          value={row.component_variant_id}
                          onChange={(event) => updateBomRow(row.key, { component_variant_id: event.target.value })}
                          disabled={optionsLoading || !row.component_product_id}
                          options={componentVariants.map((option) => ({
                            value: option.uuid,
                            label: `${option.sku} · ${option.name}`,
                          }))}
                          placeholder="— Any variant —"
                          labelClassName={rowLabelClass}
                          className={rowInputClass}
                        />
                        <TextField
                          label="Qty"
                          type="number"
                          value={row.qty}
                          onChange={(event) => updateBomRow(row.key, { qty: event.target.value })}
                          min={1}
                          step={1}
                          labelClassName={rowLabelClass}
                          className={rowInputClass}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeBomRow(row.key)}
                          aria-label={`Remove bill-of-materials row ${index + 1}`}
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending || optionsLoading}
              className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isPending ? "Saving..." : mode === "create" ? "Create product" : "Save changes"}
            </button>
            <Link
              href={PRODUCT_LIST_PATH}
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
