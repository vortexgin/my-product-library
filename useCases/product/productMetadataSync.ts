import { randomUUID } from "crypto";
import { UniqueConstraintError } from "sequelize";
import ProductMetadataModelFactory, { ProductMetadataModel } from "@/app/product/models/ProductMetadataModel";
import ProductMetadataFieldModelFactory, { ProductMetadataFieldModel } from "@/app/product/models/ProductMetadataFieldModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";
import NotFoundException from "@/exceptions/NotFoundException";
import BadParameterException from "@/exceptions/BadParameterException";

export type MetadataNestedItem = {
  uuid?: string;
  product_metadata_field_id?: string;
  field_name?: string;
  variant_id?: string | null;
  value: string;
};

/**
 * Resolves a nested metadata item to a field uuid: by id, or reuse-by-name /
 * create-by-name per organization. Returns null when the item names no field.
 */
export async function resolveMetadataFieldId(
  item: MetadataNestedItem,
  organizationId: string | null,
  actor: ActivityActor,
): Promise<string | null> {
  if (item.product_metadata_field_id) {
    await ProductMetadataFieldModelFactory();
    const field = await ProductMetadataFieldModel.findOne({
      where: { uuid: item.product_metadata_field_id, deleted_at: null },
    });
    if (!field) {
      throw new NotFoundException("Product metadata field not found.");
    }
    return field.uuid;
  }

  const name = item.field_name?.trim();
  if (!name) {
    return null;
  }

  await ProductMetadataFieldModelFactory();
  const existing = await ProductMetadataFieldModel.findOne({
    where: { organization_id: organizationId, name, deleted_at: null },
  });
  if (existing) {
    return existing.uuid;
  }

  const created = await ProductMetadataFieldModel.create({
    uuid: randomUUID(),
    organization_id: organizationId ?? null,
    name,
    description: name,
    status: "active",
    deleted_at: null,
  });
  void recordActivityLog({
    actor: actor ?? null,
    operation: "create",
    entity: "product_metadata_field",
    entity_uuid: created.uuid,
    origin: null,
    updated: { uuid: created.uuid, name } as unknown as Record<string, unknown>,
  });
  return created.uuid;
}

async function insertMetadataRow(
  productId: string,
  variantId: string | null,
  fieldId: string,
  value: string,
  actor: ActivityActor,
): Promise<void> {
  await ProductMetadataModelFactory();
  let row;
  try {
    row = await ProductMetadataModel.create({
      uuid: randomUUID(),
      product_id: productId,
      variant_id: variantId,
      product_metadata_field_id: fieldId,
      value: value?.trim(),
      status: "active",
      deleted_at: null,
    });
  } catch (error) {
    // Concurrent syncs racing on the same scope+field: same 409 as direct create.
    if (error instanceof UniqueConstraintError) {
      throw new DuplicateEntityException("Product metadata for this field already exists.");
    }
    throw error;
  }
  void recordActivityLog({
    actor: actor ?? null,
    operation: "create",
    entity: "product_metadata",
    entity_uuid: row.uuid,
    origin: null,
    updated: ProductMetadataModel.toApi(row.toJSON()) as unknown as Record<string, unknown>,
  });
}

/**
 * Full-replacement sync within one scope (product-level when variantId is
 * null, variant-level otherwise): items carrying a uuid update the matching
 * in-scope row, new items insert, omitted in-scope rows soft-delete. Rows
 * outside the scope are untouched.
 */
export async function syncProductMetadata(
  productId: string,
  variantId: string | null,
  items: MetadataNestedItem[] | undefined,
  organizationId: string | null,
  actor: ActivityActor,
): Promise<void> {
  await ProductMetadataModelFactory();
  const existing = await ProductMetadataModel.findAll({
    where: { product_id: productId, variant_id: variantId, deleted_at: null },
  });
  const byUuid = new Map(existing.map((row) => [row.uuid, row]));
  const seen = new Set<string>();

  for (const item of items ?? []) {
    if (item.uuid) {
      const row = byUuid.get(item.uuid);
      if (!row) {
        throw new BadParameterException("Metadata row does not belong to this scope.");
      }
      seen.add(item.uuid);
      await row.update({ value: item.value?.trim(), updated_at: new Date() });
      continue;
    }
    const fieldId = await resolveMetadataFieldId(item, organizationId, actor);
    if (!fieldId) {
      continue;
    }
    await insertMetadataRow(productId, variantId, fieldId, item.value, actor);
  }

  for (const row of existing) {
    if (!seen.has(row.uuid)) {
      await row.update({ status: "deleted", deleted_at: new Date(), updated_at: new Date() });
    }
  }
}
