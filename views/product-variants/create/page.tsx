import type { Metadata } from "next";
import { AuthComponent } from "@/components/AuthComponent";
import { AccessDenied } from "@/components/AccessDenied";
import { ProductVariantForm } from "@/app/product/components/productVariant/ProductVariantForm";
import { requireSession } from "@/libraries/Auth";

export const metadata: Metadata = {
  title: "New product variant | VortexGin",
};

export default async function ProductVariantCreatePage({
  searchParams,
}: {
  searchParams?: Promise<{ product_id?: string }>;
}) {
  const session = await requireSession();
  const query = (await searchParams) ?? {};

  return (
    <AuthComponent
      user={session.user}
      permissions={session.permissions}
      allowedPermissions={["product:variant:create:create"]}
      accessDeniedComponent={
        <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
          <AccessDenied />
        </main>
      }
    >

      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <ProductVariantForm
          mode="create"
          session={session}
          initial={query.product_id ? { product_id: query.product_id } : undefined}
        />
      </main>
    </AuthComponent>
  );
}
