import Joi from "joi";
import { Op, UniqueConstraintError } from "sequelize";
import ProductVariantModelFactory, { ProductVariantModel, type ProductVariant, type UpdateProductVariantInput } from "@/app/product/models/ProductVariantModel";
import { syncProductMetadata, type MetadataNestedItem } from "@/app/product/libraries/productMetadataSync";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";
import NotFoundException from "@/exceptions/NotFoundException";

const metadataNestedSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).optional(),
  product_metadata_field_id: Joi.string().uuid({ version: "uuidv4" }).optional(),
  field_name: Joi.string().trim().min(2).max(160).optional(),
  variant_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  value: Joi.string().trim().min(1).required(),
});

const updateProductVariantSchema = Joi.object({
  sku: Joi.string().trim().min(2).max(60).optional(),
  name: Joi.string().trim().min(2).max(160).optional(),
  price_override: Joi.number().integer().min(0).allow(null).optional(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
  metadata: Joi.array().items(metadataNestedSchema).optional(),
}).unknown(false).min(1);

export class ProductVariantUpdateUseCase extends BaseUseCase<string, ProductVariant, { uuid: string; input: UpdateProductVariantInput & { metadata?: MetadataNestedItem[] }; actor: ActivityActor }> {

  private productVariantData?: ProductVariantModel | null;
  private beforeData?: ProductVariant | null;

  protected async preExec(uuid: string, input: UpdateProductVariantInput, actor?: ActivityActor): Promise<{ uuid: string; input: UpdateProductVariantInput & { metadata?: MetadataNestedItem[] }; actor: ActivityActor }> {
    const validatedInput = await this.validate<UpdateProductVariantInput & { metadata?: MetadataNestedItem[] }>(updateProductVariantSchema, input);

    await ProductVariantModelFactory();
    this.productVariantData = await ProductVariantModel.findOne({ where: { uuid, deleted_at: null } });
    if (!this.productVariantData) {
      throw new NotFoundException("Product variant not found")
    }
    this.beforeData = ProductVariantModel.toApi(this.productVariantData?.toJSON());

    if (validatedInput.sku) {
      const skuTaken = await ProductVariantModel.findOne({
        where: {
          sku: validatedInput.sku.trim().toUpperCase(),
          organization_id: this.beforeData?.organization_id ?? null,
          uuid: { [Op.ne]: uuid },
          deleted_at: null,
        },
      });
      if (skuTaken) {
        throw new DuplicateEntityException("A product variant with this SKU already exists.");
      }
    }

    return { uuid, input: validatedInput, actor: actor ?? null };
  }

  protected async execute(context: { uuid: string; input: UpdateProductVariantInput & { metadata?: MetadataNestedItem[] }; actor: ActivityActor }): Promise<ProductVariant> {
    const { uuid, input, actor } = context;
    const nextData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (typeof input.sku === "string" && input.sku.trim()) {
      nextData.sku = input.sku.trim().toUpperCase();
    }

    if (typeof input.name === "string" && input.name.trim()) {
      nextData.name = input.name.trim();
    }

    if (Object.prototype.hasOwnProperty.call(input, "price_override")) {
      nextData.price_override = typeof input.price_override === "number" ? input.price_override : null;
    }

    if (input.status) {
      nextData.status = input.status;
      if (input.status === "deleted") {
        nextData.deleted_at = new Date();
      } else {
        nextData.deleted_at = null;
      }
    }

    try {
      await this.productVariantData?.update(nextData);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("A product variant with this SKU already exists.");
      }
      throw error;
    }

    // Full-replacement sync, variant scope only — product-level rows untouched.
    if (Object.prototype.hasOwnProperty.call(input, "metadata")) {
      const api = ProductVariantModel.toApi(this.productVariantData?.toJSON());
      await syncProductMetadata(
        api.product_id,
        uuid,
        input.metadata?.map((item) => ({ ...item, variant_id: uuid })),
        api.organization_id,
        actor,
      );
    }

    return ProductVariantModel.toApi(this.productVariantData?.toJSON());
  }

  protected async postExec(
    result: ProductVariant,
    context?: { uuid: string; input: UpdateProductVariantInput; actor: ActivityActor },
  ): Promise<ProductVariant> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "update",
      entity: "product_variant",
      entity_uuid: context?.uuid ?? result.uuid,
      origin: this.beforeData ?? null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}
