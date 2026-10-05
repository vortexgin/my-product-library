import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDatabase } from "@/database/sequelize";
import { AuthComponent } from "@/components/AuthComponent";
import { AccessDenied } from "@/components/AccessDenied";
import { ProductVariantForm } from "@/app/product/components/productVariant/ProductVariantForm";
import { requireSession } from "@/libraries/Auth";
import { ProductVariantGetUseCase } from "@/app/product/useCases/productVariant/ProductVariantGetUseCase";
import { ProductMetadataListUseCase } from "@/app/product/useCases/productMetadata/ProductMetadataListUseCase";
import { ProductMetadataFieldListUseCase } from "@/app/product/useCases/productMetadataField/ProductMetadataFieldListUseCase";

export const metadata: Metadata = {
  title: "Edit product variant | VortexGin",
};

export default async function ProductVariantEditPage({
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

  // Variant-scope metadata rows with field names for the form's initial rows.
  const [metadataRows, fields] = await Promise.all([
    new ProductMetadataListUseCase().exec({ filter: { variant_id: uuid }, limit: 100 }).catch(() => []),
    new ProductMetadataFieldListUseCase().exec({ limit: 100 }).catch(() => []),
  ]);
  const fieldNames = new Map(fields.map((field) => [field.uuid, field.name]));

  return (
    <AuthComponent
      user={session.user}
      permissions={session.permissions}
      allowedPermissions={["product:variant:view:update"]}
      accessDeniedComponent={
        <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <AccessDenied />
        </main>
      }
    >
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <ProductVariantForm
          mode="edit"
          uuid={variant.uuid}
          session={session}
          initial={{
            product_id: variant.product_id,
            sku: variant.sku,
            name: variant.name,
            price_override: variant.price_override,
            status: variant.status,
            metadata: metadataRows.map((row) => ({
              uuid: row.uuid,
              product_metadata_field_id: row.product_metadata_field_id,
              value: row.value,
              field_name: fieldNames.get(row.product_metadata_field_id),
            })),
          }}
        />
      </main>
    </AuthComponent>
  );
}
