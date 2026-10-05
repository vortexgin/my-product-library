import { randomUUID } from "crypto";
import Joi from "joi";
import { UniqueConstraintError } from "sequelize";
import ProductUnitModelFactory, { ProductUnitModel, type CreateProductUnitInput, type ProductUnit } from "@/app/product/models/ProductUnitModel";
import { UserModel } from "@/app/base/models/UserModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";

const createProductUnitSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160).required(),
  symbol: Joi.string().trim().min(1).max(10).required(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
});

export class ProductUnitCreateUseCase extends BaseUseCase<CreateProductUnitInput, ProductUnit, { input: CreateProductUnitInput; actor: ActivityActor; organizationId: string | null }> {
  protected async preExec(input: CreateProductUnitInput, actor?: ActivityActor): Promise<{ input: CreateProductUnitInput; actor: ActivityActor; organizationId: string | null }> {
    const validated = await this.validate<CreateProductUnitInput>(createProductUnitSchema, input);

    const actorUuid = (actor as Record<string, unknown> | null)?.uuid;
    const organizationId =
      typeof actorUuid === "string" ? ((await UserModel.resolveOrganization(actorUuid))?.uuid ?? null) : null;

    await ProductUnitModelFactory();
    const existingRow = await ProductUnitModel.findOne({
      where: { organization_id: organizationId, name: validated.name.trim(), deleted_at: null },
    });
    if (existingRow) {
      throw new DuplicateEntityException("A product unit with this name already exists.");
    }

    return { input: validated, actor: actor ?? null, organizationId };
  }

  protected async execute(context: { input: CreateProductUnitInput; actor: ActivityActor; organizationId: string | null }): Promise<ProductUnit> {
    const { input, organizationId } = context;
    await ProductUnitModelFactory();
    try {
      const row = await ProductUnitModel.create({
        uuid: randomUUID(),
        organization_id: organizationId ?? null,
        name: input.name?.trim(),
        symbol: input.symbol?.trim(),
        status: input.status ?? "active",
        deleted_at: null,
      });

      return ProductUnitModel.toApi(row.toJSON());
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("A product unit with this name already exists.");
      }
      throw error;
    }
  }

  protected async postExec(
    result: ProductUnit,
    context?: { input: CreateProductUnitInput; actor: ActivityActor; organizationId: string | null },
  ): Promise<ProductUnit> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "create",
      entity: "product_unit",
      entity_uuid: result.uuid,
      origin: null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}

/**
 * Lazy `pcs` seeder: find-or-create the default unit for an organization,
 * used by product create when no unit is supplied. Logs a plain row on create.
 */
export async function ensurePcsUnit(
  organizationId: string | null,
  actor?: ActivityActor,
): Promise<ProductUnit> {
  await ProductUnitModelFactory();
  const existing = await ProductUnitModel.findOne({
    where: { organization_id: organizationId, name: "pcs", deleted_at: null },
  });
  if (existing) {
    return ProductUnitModel.toApi(existing.toJSON());
  }

  const row = await ProductUnitModel.create({
    uuid: randomUUID(),
    organization_id: organizationId ?? null,
    name: "pcs",
    symbol: "pcs",
    status: "active",
    deleted_at: null,
  });
  const api = ProductUnitModel.toApi(row.toJSON());
  void recordActivityLog({
    actor: actor ?? null,
    operation: "create",
    entity: "product_unit",
    entity_uuid: api.uuid,
    origin: null,
    updated: api,
  });
  return api;
}
