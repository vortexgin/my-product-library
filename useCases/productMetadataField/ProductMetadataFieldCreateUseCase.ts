import { randomUUID } from "crypto";
import Joi from "joi";
import { UniqueConstraintError } from "sequelize";
import ProductMetadataFieldModelFactory, { ProductMetadataFieldModel, type CreateProductMetadataFieldInput, type ProductMetadataField } from "@/app/product/models/ProductMetadataFieldModel";
import { UserModel } from "@/app/base/models/UserModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";

const createProductMetadataFieldSchema = Joi.object({
  name: Joi.string().trim().min(2).max(160).required(),
  description: Joi.string().trim().min(2).required(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
});

export class ProductMetadataFieldCreateUseCase extends BaseUseCase<CreateProductMetadataFieldInput, ProductMetadataField, { input: CreateProductMetadataFieldInput; actor: ActivityActor; organizationId: string | null }> {
  protected async preExec(input: CreateProductMetadataFieldInput, actor?: ActivityActor): Promise<{ input: CreateProductMetadataFieldInput; actor: ActivityActor; organizationId: string | null }> {
    const validated = await this.validate<CreateProductMetadataFieldInput>(createProductMetadataFieldSchema, input);

    const actorUuid = (actor as Record<string, unknown> | null)?.uuid;
    const organizationId =
      typeof actorUuid === "string" ? ((await UserModel.resolveOrganization(actorUuid))?.uuid ?? null) : null;

    await ProductMetadataFieldModelFactory();
    const existingRow = await ProductMetadataFieldModel.findOne({
      where: { organization_id: organizationId, name: validated.name.trim(), deleted_at: null },
    });
    if (existingRow) {
      throw new DuplicateEntityException("A product metadata field with this name already exists.");
    }

    return { input: validated, actor: actor ?? null, organizationId };
  }

  protected async execute(context: { input: CreateProductMetadataFieldInput; actor: ActivityActor; organizationId: string | null }): Promise<ProductMetadataField> {
    const { input, organizationId } = context;
    await ProductMetadataFieldModelFactory();
    try {
      const row = await ProductMetadataFieldModel.create({
        uuid: randomUUID(),
        organization_id: organizationId ?? null,
        name: input.name?.trim(),
        description: input.description?.trim(),
        status: input.status ?? "active",
        deleted_at: null,
      });

      return ProductMetadataFieldModel.toApi(row.toJSON());
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("A product metadata field with this name already exists.");
      }
      throw error;
    }
  }

  protected async postExec(
    result: ProductMetadataField,
    context?: { input: CreateProductMetadataFieldInput; actor: ActivityActor; organizationId: string | null },
  ): Promise<ProductMetadataField> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "create",
      entity: "product_metadata_field",
      entity_uuid: result.uuid,
      origin: null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}
