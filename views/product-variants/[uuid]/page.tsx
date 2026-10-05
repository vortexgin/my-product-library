import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { connectDatabase } from "@/database/sequelize";
import { AuthComponent } from "@/components/AuthComponent";
import { AccessDenied } from "@/components/AccessDenied";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { DeleteProductVariantButton } from "@/app/product/components/productVariant/DeleteProductVariantButton";
import { PRODUCT_VARIANT_LIST_PATH } from "@/app/product/views/products/paths";
import { requireSession } from "@/libraries/Auth";
import { ProductVariantGetUseCase } from "@/app/product/useCases/productVariant/ProductVariantGetUseCase";
import { ProductGetUseCase } from "@/app/product/useCases/product/ProductGetUseCase";
import { ProductMetadataListUseCase } from "@/app/product/useCases/productMetadata/ProductMetadataListUseCase";
import { ProductMetadataFieldListUseCase } from "@/app/product/useCases/productMetadataField/ProductMetadataFieldListUseCase";
import { resolveEffectivePrice } from "@/app/product/models/ProductVariantModel";

export const metadata: Metadata = {
  title: "Product variant detail | VortexGin",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="break-all text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export default async function ProductVariantDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const session = await requireSession();

  const { uuid } = await params;
  await connectDatabase();

  let variant;
  try {
    variant = await new ProductVariantGetUseCase().exec(uuid);
  } catch {
    notFound();
  }
  if (!variant) {
    notFound();
  }

  const [product, metadataRows, fields] = await Promise.all([
    new ProductGetUseCase().exec(variant.product_id).catch(() => null),
    new ProductMetadataListUseCase().exec({ filter: { variant_id: uuid }, limit: 100 }).catch(() => []),
    new ProductMetadataFieldListUseCase().exec({ limit: 100 }).catch(() => []),
  ]);
  const productName = product ? `${product.name} · ${product.sku}` : "—";
  const fieldNames = new Map(fields.map((field) => [field.uuid, field.name]));

  return (
    <AuthComponent
      user={session.user}
      permissions={session.permissions}
      allowedPermissions={["product:variant:view:detail"]}
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
              {variant.name}
            </h1>

            <dl className="mt-6">
              <Row label="UUID" value={variant.uuid} />
              <Row label="SKU" value={variant.sku} />
              <Row label="Name" value={variant.name} />
              <Row label="Product" value={productName} />
              <Row label="Price override" value={variant.price_override !== null ? String(variant.price_override) : "— (base price)"} />
              <Row label="Effective price" value={String(resolveEffectivePrice(variant, product?.base_price ?? 0))} />
              <Row label="Status" value={variant.status} />
              <Row label="Created" value={variant.created_at} />
              <Row label="Updated" value={variant.updated_at} />
            </dl>

            {metadataRows.length > 0 ? (
              <>
                <p className="mt-6 text-sm font-medium uppercase tracking-[0.2em] text-blue-600">Metadata</p>
                <dl className="mt-2">
                  {metadataRows.map((row) => (
                    <Row
                      key={row.uuid}
                      label={fieldNames.get(row.product_metadata_field_id) ?? row.product_metadata_field_id}
                      value={row.value}
                    />
                  ))}
                </dl>
              </>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={`/product/views/products/${variant.product_id}`}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Back to product
              </Link>
              <AuthComponent
                user={session.user}
                permissions={session.permissions}
                allowedPermissions={["product:variant:view:update"]}
              >
                <Link
                  href={`/product/views/product-variants/${variant.uuid}/edit`}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Edit
                </Link>
              </AuthComponent>
              <AuthComponent
                user={session.user}
                permissions={session.permissions}
                allowedPermissions={["product:variant:view:delete"]}
              >
                <DeleteProductVariantButton uuid={variant.uuid} label={variant.name} redirectTo={PRODUCT_VARIANT_LIST_PATH} />
              </AuthComponent>

            </div>
          </div>
          <ActivityTimeline entity="product_variant" entityUuid={variant.uuid} />
        </div>
      </main>
    </AuthComponent>
  );
}
