import Joi from "joi";
import ProductMetadataModelFactory, { ProductMetadataModel, type ProductMetadata, type UpdateProductMetadataInput } from "@/app/product/models/ProductMetadataModel";
import ProductVariantModelFactory, { ProductVariantModel } from "@/app/product/models/ProductVariantModel";
import ProductMetadataFieldModelFactory, { ProductMetadataFieldModel } from "@/app/product/models/ProductMetadataFieldModel";
import { assertProductInScope } from "@/app/product/useCases/productMetadata/ProductMetadataCreateUseCase";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const updateProductMetadataSchema = Joi.object({
  variant_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  product_metadata_field_id: Joi.string().uuid({ version: "uuidv4" }).optional(),
  value: Joi.string().trim().min(1).optional(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
}).unknown(false).min(1);

export class ProductMetadataUpdateUseCase extends BaseUseCase<string, ProductMetadata, { uuid: string; input: UpdateProductMetadataInput; actor: ActivityActor }> {

  private productMetadataData?: ProductMetadataModel | null;
  private beforeData?: ProductMetadata | null;

  protected async preExec(uuid: string, input: UpdateProductMetadataInput, actor?: ActivityActor): Promise<{ uuid: string; input: UpdateProductMetadataInput; actor: ActivityActor }> {
    const validatedInput = await this.validate<UpdateProductMetadataInput>(updateProductMetadataSchema, input);

    await ProductMetadataModelFactory();
    this.productMetadataData = await ProductMetadataModel.findOne({ where: { uuid, deleted_at: null } });
    if (!this.productMetadataData) {
      throw new NotFoundException("Product metadata not found")
    }
    this.beforeData = ProductMetadataModel.toApi(this.productMetadataData?.toJSON());

    await assertProductInScope(this.beforeData.product_id, actor ?? null);

    if (validatedInput.variant_id) {
      await ProductVariantModelFactory();
      const variant = await ProductVariantModel.findOne({ where: { uuid: validatedInput.variant_id, deleted_at: null } });
      if (!variant || variant.product_id !== this.beforeData.product_id) {
        throw new NotFoundException("Product variant not found for this product.");
      }
    }

    if (validatedInput.product_metadata_field_id) {
      await ProductMetadataFieldModelFactory();
      const field = await ProductMetadataFieldModel.findOne({ where: { uuid: validatedInput.product_metadata_field_id, deleted_at: null } });
      if (!field) {
        throw new NotFoundException("Product metadata field not found.");
      }
    }

    return { uuid, input: validatedInput, actor: actor ?? null };
  }

  protected async execute(context: { uuid: string; input: UpdateProductMetadataInput; actor: ActivityActor }): Promise<ProductMetadata> {
    const { input } = context;
    const nextData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (Object.prototype.hasOwnProperty.call(input, "variant_id")) {
      nextData.variant_id = input.variant_id ?? null;
    }

    if (input.product_metadata_field_id) {
      nextData.product_metadata_field_id = input.product_metadata_field_id;
    }

    if (typeof input.value === "string" && input.value.trim()) {
      nextData.value = input.value.trim();
    }

    if (input.status) {
      nextData.status = input.status;
      if (input.status === "deleted") {
        nextData.deleted_at = new Date();
      } else {
        nextData.deleted_at = null;
      }
    }

    await this.productMetadataData?.update(nextData);

    return ProductMetadataModel.toApi(this.productMetadataData?.toJSON());
  }

  protected async postExec(
    result: ProductMetadata,
    context?: { uuid: string; input: UpdateProductMetadataInput; actor: ActivityActor },
  ): Promise<ProductMetadata> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "update",
      entity: "product_metadata",
      entity_uuid: context?.uuid ?? result.uuid,
      origin: this.beforeData ?? null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}
