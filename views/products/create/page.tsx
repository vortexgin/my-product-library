import type { Metadata } from "next";
import { AuthComponent } from "@/components/AuthComponent";
import { AccessDenied } from "@/components/AccessDenied";
import { ProductForm } from "@/app/product/components/product/ProductForm";
import { requireSession } from "@/libraries/Auth";

export const metadata: Metadata = {
  title: "New product | VortexGin",
};

export default async function ProductCreatePage() {
  const session = await requireSession();

  return (
    <AuthComponent
      user={session.user}
      permissions={session.permissions}
      allowedPermissions={["product:product:create:create"]}
      accessDeniedComponent={
        <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <AccessDenied />
        </main>
      }
    >

      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <ProductForm mode="create" session={session} />
      </main>
    </AuthComponent>
  );
}
