import { randomUUID } from "crypto";
import Joi from "joi";
import { UniqueConstraintError } from "sequelize";
import ProductMetadataModelFactory, { ProductMetadataModel, type CreateProductMetadataInput, type ProductMetadata } from "@/app/product/models/ProductMetadataModel";
import ProductModelFactory, { ProductModel } from "@/app/product/models/ProductModel";
import ProductVariantModelFactory, { ProductVariantModel } from "@/app/product/models/ProductVariantModel";
import ProductMetadataFieldModelFactory, { ProductMetadataFieldModel } from "@/app/product/models/ProductMetadataFieldModel";
import { UserModel } from "@/app/base/models/UserModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";
import ForbiddenException from "@/exceptions/ForbiddenException";
import NotFoundException from "@/exceptions/NotFoundException";

const createProductMetadataSchema = Joi.object({
  product_id: Joi.string().uuid({ version: "uuidv4" }).required(),
  variant_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  product_metadata_field_id: Joi.string().uuid({ version: "uuidv4" }).required(),
  value: Joi.string().trim().min(1).required(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
}).unknown(false);

/** Rejects cross-org product references with 403 (linked actors only). */
export async function assertProductInScope(productId: string, actor: ActivityActor): Promise<void> {
  const actorUuid = (actor as Record<string, unknown> | null)?.uuid;
  if (typeof actorUuid !== "string") {
    return;
  }

  await ProductModelFactory();
  const product = await ProductModel.findOne({ where: { uuid: productId, deleted_at: null } });
  if (!product) {
    throw new NotFoundException("Product not found.");
  }

  const organizationId = (await UserModel.resolveOrganization(actorUuid))?.uuid ?? null;
  if (organizationId && (product.organization_id ?? null) !== organizationId) {
    throw new ForbiddenException("Product belongs to another organization.");
  }
}

export class ProductMetadataCreateUseCase extends BaseUseCase<CreateProductMetadataInput, ProductMetadata, { input: CreateProductMetadataInput; actor: ActivityActor }> {
  protected async preExec(input: CreateProductMetadataInput, actor?: ActivityActor): Promise<{ input: CreateProductMetadataInput; actor: ActivityActor }> {
    const validated = await this.validate<CreateProductMetadataInput>(createProductMetadataSchema, input);

    await assertProductInScope(validated.product_id, actor ?? null);

    if (validated.variant_id) {
      await ProductVariantModelFactory();
      const variant = await ProductVariantModel.findOne({ where: { uuid: validated.variant_id, deleted_at: null } });
      if (!variant || variant.product_id !== validated.product_id) {
        throw new NotFoundException("Product variant not found for this product.");
      }
    }

    await ProductMetadataFieldModelFactory();
    const field = await ProductMetadataFieldModel.findOne({ where: { uuid: validated.product_metadata_field_id, deleted_at: null } });
    if (!field) {
      throw new NotFoundException("Product metadata field not found.");
    }

    await ProductMetadataModelFactory();
    const existingRow = await ProductMetadataModel.findOne({
      where: {
        product_id: validated.product_id,
        variant_id: validated.variant_id ?? null,
        product_metadata_field_id: validated.product_metadata_field_id,
        deleted_at: null,
      },
    });
    if (existingRow) {
      throw new DuplicateEntityException("Product metadata for this field already exists.");
    }

    return { input: validated, actor: actor ?? null };
  }

  protected async execute(context: { input: CreateProductMetadataInput; actor: ActivityActor }): Promise<ProductMetadata> {
    const { input } = context;
    await ProductMetadataModelFactory();
    try {
      const row = await ProductMetadataModel.create({
        uuid: randomUUID(),
        product_id: input.product_id,
        variant_id: input.variant_id ?? null,
        product_metadata_field_id: input.product_metadata_field_id,
        value: input.value?.trim(),
        status: input.status ?? "active",
        deleted_at: null,
      });

      return ProductMetadataModel.toApi(row.toJSON());
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("Product metadata for this field already exists.");
      }
      throw error;
    }
  }

  protected async postExec(
    result: ProductMetadata,
    context?: { input: CreateProductMetadataInput; actor: ActivityActor },
  ): Promise<ProductMetadata> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "create",
      entity: "product_metadata",
      entity_uuid: result.uuid,
      origin: null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}
