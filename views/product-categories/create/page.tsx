import type { Metadata } from "next";
import { AuthComponent } from "@/components/AuthComponent";
import { AccessDenied } from "@/components/AccessDenied";
import { ProductCategoryForm } from "@/app/product/components/productCategory/ProductCategoryForm";
import { requireSession } from "@/libraries/Auth";

export const metadata: Metadata = {
  title: "New product category | VortexGin",
};

export default async function ProductCategoryCreatePage() {
  const session = await requireSession();

  return (
    <AuthComponent
      user={session.user}
      permissions={session.permissions}
      allowedPermissions={["product:category:create:create"]}
      accessDeniedComponent={
        <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <AccessDenied />
        </main>
      }
    >

      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <ProductCategoryForm mode="create" />
      </main>
    </AuthComponent>
  );
}
