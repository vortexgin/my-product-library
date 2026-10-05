import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { connectDatabase } from "@/database/sequelize";
import { AuthComponent } from "@/components/AuthComponent";
import { AccessDenied } from "@/components/AccessDenied";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { DeleteProductButton } from "@/app/product/components/product/DeleteProductButton";
import { PRODUCT_LIST_PATH } from "@/app/product/views/products/paths";
import { requireSession } from "@/libraries/Auth";
import { ProductGetUseCase } from "@/app/product/useCases/product/ProductGetUseCase";
import { ProductVariantListUseCase } from "@/app/product/useCases/productVariant/ProductVariantListUseCase";
import { ProductMetadataListUseCase } from "@/app/product/useCases/productMetadata/ProductMetadataListUseCase";
import { ProductMetadataFieldListUseCase } from "@/app/product/useCases/productMetadataField/ProductMetadataFieldListUseCase";
import { ProductCategoryGetUseCase } from "@/app/product/useCases/productCategory/ProductCategoryGetUseCase";
import { ProductUnitGetUseCase } from "@/app/product/useCases/productUnit/ProductUnitGetUseCase";
import { resolveEffectivePrice } from "@/app/product/models/ProductVariantModel";

export const metadata: Metadata = {
  title: "Product detail | VortexGin",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="break-all text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const session = await requireSession();

  const { uuid } = await params;
  await connectDatabase();

  let product;
  try {
    product = await new ProductGetUseCase().exec(uuid);
  } catch {
    notFound();
  }
  if (!product) {
    notFound();
  }

  const [variants, metadataRows, fields, categoryName, unitLabel] = await Promise.all([
    new ProductVariantListUseCase()
      .exec({ filter: { product_id: uuid }, limit: 100 }, session.user)
      .catch(() => []),
    new ProductMetadataListUseCase()
      .exec({ filter: { product_id: uuid }, limit: 100 })
      .catch(() => []),
    new ProductMetadataFieldListUseCase()
      .exec({ limit: 500 })
      .catch(() => []),
    product.category_id
      ? new ProductCategoryGetUseCase().exec(product.category_id).then((row) => row?.name ?? "—").catch(() => "—")
      : Promise.resolve("—"),
    product.unit_id
      ? new ProductUnitGetUseCase().exec(product.unit_id).then((row) => (row ? `${row.name} (${row.symbol})` : "—")).catch(() => "—")
      : Promise.resolve("—"),
  ]);
  const fieldNames = new Map(fields.map((field) => [field.uuid, field.name]));
  const productMetadata = metadataRows.filter((row) => !row.variant_id);

  return (
    <AuthComponent
      user={session.user}
      permissions={session.permissions}
      allowedPermissions={["product:product:view:detail"]}
      accessDeniedComponent={
        <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <AccessDenied />
        </main>
      }
    >

      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Detail</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {product.name}
            </h1>

            <dl className="mt-6">
              <Row label="UUID" value={product.uuid} />
              <Row label="SKU" value={product.sku} />
              <Row label="Name" value={product.name} />
              <Row label="Description" value={product.description ?? "—"} />
              <Row label="Category" value={categoryName} />
              <Row label="Unit" value={unitLabel} />
              <Row label="Base price" value={String(product.base_price)} />
              <Row label="Status" value={product.status} />
              <Row label="Created" value={product.created_at} />
              <Row label="Updated" value={product.updated_at} />
            </dl>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={PRODUCT_LIST_PATH}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Back to list
              </Link>
              <AuthComponent
                user={session.user}
                permissions={session.permissions}
                allowedPermissions={["product:product:view:update"]}
              >
                <Link
                  href={`/product/views/products/${product.uuid}/edit`}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Edit
                </Link>
              </AuthComponent>
              <AuthComponent
                user={session.user}
                permissions={session.permissions}
                allowedPermissions={["product:product:view:delete"]}
              >
                <DeleteProductButton uuid={product.uuid} label={product.name} redirectTo={PRODUCT_LIST_PATH} />
              </AuthComponent>

            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Variants</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Options.</h2>
              </div>
              <AuthComponent
                user={session.user}
                permissions={session.permissions}
                allowedPermissions={["product:variant:create:create"]}
              >
                <Link
                  href={`/product/views/product-variants/create?product_id=${product.uuid}`}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  New variant
                </Link>
              </AuthComponent>
            </div>
            {variants.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No variants yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {variants.map((variant) => (
                  <li key={variant.uuid} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/product/views/product-variants/${variant.uuid}`}
                        className="font-medium text-blue-600 hover:text-blue-500"
                      >
                        {variant.name} · {variant.sku}
                      </Link>
                      <span className="inline-flex rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        {resolveEffectivePrice(variant, product.base_price)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {variant.price_override !== null ? `Override ${variant.price_override}` : "Base price"} · {variant.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {productMetadata.length > 0 ? (
            <div className="mt-6 rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-8">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Metadata</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Details.</h2>
              <dl className="mt-4">
                {productMetadata.map((row) => (
                  <Row
                    key={row.uuid}
                    label={fieldNames.get(row.product_metadata_field_id) ?? row.product_metadata_field_id}
                    value={row.value}
                  />
                ))}
              </dl>
            </div>
          ) : null}

          <ActivityTimeline entity="product" entityUuid={product.uuid} />
        </div>
      </main>
    </AuthComponent>
  );
}
