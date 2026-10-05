import Joi from "joi";
import { Op, UniqueConstraintError } from "sequelize";
import ProductMetadataFieldModelFactory, { ProductMetadataFieldModel, type ProductMetadataField, type UpdateProductMetadataFieldInput } from "@/app/product/models/ProductMetadataFieldModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";
import NotFoundException from "@/exceptions/NotFoundException";

const updateProductMetadataFieldSchema = Joi.object({
  name: Joi.string().trim().min(2).max(160).optional(),
  description: Joi.string().trim().min(2).optional(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
}).min(1);

export class ProductMetadataFieldUpdateUseCase extends BaseUseCase<string, ProductMetadataField, { uuid: string; input: UpdateProductMetadataFieldInput; actor: ActivityActor }> {

  private productMetadataFieldData?: ProductMetadataFieldModel | null;
  private beforeData?: ProductMetadataField | null;

  protected async preExec(uuid: string, input: UpdateProductMetadataFieldInput, actor?: ActivityActor): Promise<{ uuid: string; input: UpdateProductMetadataFieldInput; actor: ActivityActor }> {
    const validatedInput = await this.validate<UpdateProductMetadataFieldInput>(updateProductMetadataFieldSchema, input);

    await ProductMetadataFieldModelFactory();
    this.productMetadataFieldData = await ProductMetadataFieldModel.findOne({ where: { uuid, deleted_at: null } });
    if (!this.productMetadataFieldData) {
      throw new NotFoundException("Product metadata field not found")
    }
    this.beforeData = ProductMetadataFieldModel.toApi(this.productMetadataFieldData?.toJSON());

    if (validatedInput.name?.trim()) {
      const nameTaken = await ProductMetadataFieldModel.findOne({
        where: {
          organization_id: this.beforeData?.organization_id ?? null,
          name: validatedInput.name.trim(),
          uuid: { [Op.ne]: uuid },
          deleted_at: null,
        },
      });
      if (nameTaken) {
        throw new DuplicateEntityException("A product metadata field with this name already exists.");
      }
    }

    return { uuid, input: validatedInput, actor: actor ?? null };
  }

  protected async execute(context: { uuid: string; input: UpdateProductMetadataFieldInput; actor: ActivityActor }): Promise<ProductMetadataField> {
    const { input } = context;
    const nextData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (typeof input.name === "string" && input.name.trim()) {
      nextData.name = input.name.trim();
    }

    if (typeof input.description === "string" && input.description.trim()) {
      nextData.description = input.description.trim();
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
      await this.productMetadataFieldData?.update(nextData);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("A product metadata field with this name already exists.");
      }
      throw error;
    }

    return ProductMetadataFieldModel.toApi(this.productMetadataFieldData?.toJSON());
  }

  protected async postExec(
    result: ProductMetadataField,
    context?: { uuid: string; input: UpdateProductMetadataFieldInput; actor: ActivityActor },
  ): Promise<ProductMetadataField> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "update",
      entity: "product_metadata_field",
      entity_uuid: context?.uuid ?? result.uuid,
      origin: this.beforeData ?? null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}
