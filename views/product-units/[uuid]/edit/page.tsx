import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDatabase } from "@/database/sequelize";
import { AuthComponent } from "@/components/AuthComponent";
import { AccessDenied } from "@/components/AccessDenied";
import { ProductUnitForm } from "@/app/product/components/productUnit/ProductUnitForm";
import { requireSession } from "@/libraries/Auth";
import { ProductUnitGetUseCase } from "@/app/product/useCases/productUnit/ProductUnitGetUseCase";

export const metadata: Metadata = {
  title: "Edit product unit | VortexGin",
};

export default async function ProductUnitEditPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const session = await requireSession();

  const { uuid } = await params;
  await connectDatabase();

  let productUnit;
  try {
    productUnit = await new ProductUnitGetUseCase().exec(uuid);
  } catch {
    notFound();
  }
  if (!productUnit) {
    notFound();
  }

  return (
    <AuthComponent
      user={session.user}
      permissions={session.permissions}
      allowedPermissions={["product:unit:view:update"]}
      accessDeniedComponent={
        <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <AccessDenied />
        </main>
      }
    >
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <ProductUnitForm
          mode="edit"
          uuid={productUnit.uuid}
          initial={{
            name: productUnit.name,
            symbol: productUnit.symbol,
            status: productUnit.status,
          }}
        />
      </main>
    </AuthComponent>
  );
}
