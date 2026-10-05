import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectDatabase } from "@/database/sequelize";
import { AuthComponent } from "@/components/AuthComponent";
import { AccessDenied } from "@/components/AccessDenied";
import { ProductCategoryForm } from "@/app/product/components/productCategory/ProductCategoryForm";
import { requireSession } from "@/libraries/Auth";
import { ProductCategoryGetUseCase } from "@/app/product/useCases/productCategory/ProductCategoryGetUseCase";

export const metadata: Metadata = {
  title: "Edit product category | VortexGin",
};

export default async function ProductCategoryEditPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const session = await requireSession();

  const { uuid } = await params;
  await connectDatabase();

  let productCategory;
  try {
    productCategory = await new ProductCategoryGetUseCase().exec(uuid);
  } catch {
    notFound();
  }
  if (!productCategory) {
    notFound();
  }

  return (
    <AuthComponent
      user={session.user}
      permissions={session.permissions}
      allowedPermissions={["product:category:view:update"]}
      accessDeniedComponent={
        <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <AccessDenied />
        </main>
      }
    >
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <ProductCategoryForm
          mode="edit"
          uuid={productCategory.uuid}
          initial={{
            name: productCategory.name,
            description: productCategory.description,
            status: productCategory.status,
          }}
        />
      </main>
    </AuthComponent>
  );
}
