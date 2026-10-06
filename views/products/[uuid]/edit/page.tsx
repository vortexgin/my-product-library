import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDatabase } from "@/database/sequelize";
import { AuthComponent } from "@/components/AuthComponent";
import { AccessDenied } from "@/components/AccessDenied";
import { ProductForm } from "@/app/product/components/product/ProductForm";
import { requireSession } from "@/libraries/Auth";
import { ProductGetUseCase } from "@/app/product/useCases/product/ProductGetUseCase";
import { ProductMetadataListUseCase } from "@/app/product/useCases/productMetadata/ProductMetadataListUseCase";
import { ProductMetadataFieldListUseCase } from "@/app/product/useCases/productMetadataField/ProductMetadataFieldListUseCase";

export const metadata: Metadata = {
  title: "Edit product | VortexGin",
};

export default async function ProductEditPage({
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

  // Product-level metadata rows with field names for the form's initial rows.
  const [metadataRows, fields] = await Promise.all([
    new ProductMetadataListUseCase().exec({ filter: { product_id: uuid }, limit: 100 }).catch(() => []),
    new ProductMetadataFieldListUseCase().exec({ limit: 100 }).catch(() => []),
  ]);
  const fieldNames = new Map(fields.map((field) => [field.uuid, field.name]));

  return (
    <AuthComponent
      user={session.user}
      permissions={session.permissions}
      allowedPermissions={["product:product:view:update"]}
      accessDeniedComponent={
        <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <AccessDenied />
        </main>
      }
    >
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <ProductForm
          mode="edit"
          uuid={product.uuid}
          session={session}
          initial={{
            sku: product.sku,
            name: product.name,
            description: product.description,
            category_id: product.category_id,
            unit_id: product.unit_id,
            base_price: product.base_price,
            status: product.status,
            metadata: metadataRows
              .filter((row) => !row.variant_id)
              .map((row) => ({
                uuid: row.uuid,
                product_metadata_field_id: row.product_metadata_field_id,
                value: row.value,
                field_name: fieldNames.get(row.product_metadata_field_id),
              })),
            bom: (product.bom ?? []).map((row) => ({
              uuid: row.uuid,
              variant_id: row.variant_id,
              component_product_id: row.component_product_id,
              component_variant_id: row.component_variant_id,
              qty: row.qty,
            })),
          }}
        />
      </main>
    </AuthComponent>
  );
}
