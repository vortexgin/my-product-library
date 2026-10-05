import type { Metadata } from "next";
import { AuthComponent } from "@/components/AuthComponent";
import { AccessDenied } from "@/components/AccessDenied";
import { ProductUnitForm } from "@/app/product/components/productUnit/ProductUnitForm";
import { requireSession } from "@/libraries/Auth";

export const metadata: Metadata = {
  title: "New product unit | VortexGin",
};

export default async function ProductUnitCreatePage() {
  const session = await requireSession();

  return (
    <AuthComponent
      user={session.user}
      permissions={session.permissions}
      allowedPermissions={["product:unit:create:create"]}
      accessDeniedComponent={
        <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <AccessDenied />
        </main>
      }
    >

      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <ProductUnitForm mode="create" />
      </main>
    </AuthComponent>
  );
}
