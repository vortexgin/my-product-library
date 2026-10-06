import { randomUUID } from "crypto";
import { UniqueConstraintError } from "sequelize";
import ProductBomModelFactory, { ProductBomModel } from "@/app/product/models/ProductBomModel";
import ProductModelFactory, { ProductModel } from "@/app/product/models/ProductModel";
import ProductVariantModelFactory, { ProductVariantModel } from "@/app/product/models/ProductVariantModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import BadParameterException from "@/exceptions/BadParameterException";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";
import ForbiddenException from "@/exceptions/ForbiddenException";
import NotFoundException from "@/exceptions/NotFoundException";

export type BomNestedItem = {
  uuid?: string;
  component_product_id: string;
  component_variant_id?: string | null;
  variant_id?: string | null;
  qty: number;
};

async function assertComponentInScope(
  componentProductId: string,
  componentVariantId: string | null | undefined,
  organizationId: string | null,
): Promise<void> {
  await ProductModelFactory();
  const component = await ProductModel.findOne({ where: { uuid: componentProductId, deleted_at: null } });
  if (!component) {
    throw new NotFoundException("BoM component product not found.");
  }
  if (organizationId && (component.organization_id ?? null) !== organizationId) {
    throw new ForbiddenException("BoM component belongs to another organization.");
  }

  if (componentVariantId) {
    await ProductVariantModelFactory();
    const variant = await ProductVariantModel.findOne({ where: { uuid: componentVariantId, deleted_at: null } });
    if (!variant || variant.product_id !== componentProductId) {
      throw new NotFoundException("BoM component variant not found for this product.");
    }
  }
}

/**
 * Full-replacement BoM sync for one product (all variant scopes at once —
 * BoM is managed via the product API only). Items carrying a uuid update the
 * matching row's qty; new items insert; omitted rows soft-delete.
 */
export async function syncProductBom(
  productId: string,
  items: BomNestedItem[] | undefined,
  organizationId: string | null,
  actor: ActivityActor,
): Promise<void> {
  await ProductBomModelFactory();
  const existing = await ProductBomModel.findAll({
    where: { product_id: productId, deleted_at: null },
  });
  const byUuid = new Map(existing.map((row) => [row.uuid, row]));
  const identityOf = (variantId: string | null, componentProductId: string, componentVariantId: string | null) =>
    `${variantId ?? "-"}|${componentProductId}|${componentVariantId ?? "-"}`;
  const byIdentity = new Map(
    existing.map((row) => [identityOf(row.variant_id, row.component_product_id, row.component_variant_id), row]),
  );
  const seen = new Set<string>();
  const seenIdentity = new Set<string>();

  for (const item of items ?? []) {
    if (item.uuid) {
      const row = byUuid.get(item.uuid);
      if (!row) {
        throw new BadParameterException("BoM row does not belong to this product.");
      }
      seen.add(item.uuid);
      await row.update({ qty: item.qty, updated_at: new Date() });
      continue;
    }

    const componentVariantId = item.component_variant_id ?? null;
    const scopeVariantId = item.variant_id ?? null;
    if (item.component_product_id === productId && componentVariantId === scopeVariantId) {
      throw new BadParameterException("A product cannot include itself in its bill of materials.");
    }
    await assertComponentInScope(item.component_product_id, componentVariantId, organizationId);

    // Same identity twice in one payload is ambiguous — reject.
    const identity = identityOf(scopeVariantId, item.component_product_id, componentVariantId);
    if (seenIdentity.has(identity)) {
      throw new DuplicateEntityException("Duplicate bill-of-materials row.");
    }
    seenIdentity.add(identity);

    // Idempotent resubmit: an identity-matching active row is updated, not duplicated.
    const same = byIdentity.get(identityOf(scopeVariantId, item.component_product_id, componentVariantId));
    if (same) {
      seen.add(same.uuid);
      await same.update({ qty: item.qty, updated_at: new Date() });
      continue;
    }

    try {
      const row = await ProductBomModel.create({
        uuid: randomUUID(),
        organization_id: organizationId ?? null,
        product_id: productId,
        variant_id: scopeVariantId,
        component_product_id: item.component_product_id,
        component_variant_id: componentVariantId,
        qty: item.qty,
        status: "active",
        deleted_at: null,
      });
      seen.add(row.uuid);
      void recordActivityLog({
        actor: actor ?? null,
        operation: "create",
        entity: "product_bom",
        entity_uuid: row.uuid,
        origin: null,
        updated: ProductBomModel.toApi(row.toJSON()) as unknown as Record<string, unknown>,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("Duplicate bill-of-materials row.");
      }
      throw error;
    }
  }

  for (const row of existing) {
    if (!seen.has(row.uuid)) {
      await row.update({ status: "deleted", deleted_at: new Date(), updated_at: new Date() });
    }
  }
}
