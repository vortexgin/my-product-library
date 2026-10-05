import Joi from "joi";
import { Op, UniqueConstraintError } from "sequelize";
import ProductCategoryModelFactory, { ProductCategoryModel, type ProductCategory, type UpdateProductCategoryInput } from "@/app/product/models/ProductCategoryModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";
import NotFoundException from "@/exceptions/NotFoundException";

const updateProductCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(160).optional(),
  description: Joi.string().trim().min(2).optional(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
}).min(1);

export class ProductCategoryUpdateUseCase extends BaseUseCase<string, ProductCategory, { uuid: string; input: UpdateProductCategoryInput; actor: ActivityActor }> {

  private productCategoryData?: ProductCategoryModel | null;
  private beforeData?: ProductCategory | null;

  protected async preExec(uuid: string, input: UpdateProductCategoryInput, actor?: ActivityActor): Promise<{ uuid: string; input: UpdateProductCategoryInput; actor: ActivityActor }> {
    const validatedInput = await this.validate<UpdateProductCategoryInput>(updateProductCategorySchema, input);

    await ProductCategoryModelFactory();
    this.productCategoryData = await ProductCategoryModel.findOne({ where: { uuid, deleted_at: null } });
    if (!this.productCategoryData) {
      throw new NotFoundException("Product category not found")
    }
    this.beforeData = ProductCategoryModel.toApi(this.productCategoryData?.toJSON());

    if (validatedInput.name?.trim()) {
      const nameTaken = await ProductCategoryModel.findOne({
        where: {
          organization_id: this.beforeData?.organization_id ?? null,
          name: validatedInput.name.trim(),
          uuid: { [Op.ne]: uuid },
          deleted_at: null,
        },
      });
      if (nameTaken) {
        throw new DuplicateEntityException("A product category with this name already exists.");
      }
    }

    return { uuid, input: validatedInput, actor: actor ?? null };
  }

  protected async execute(context: { uuid: string; input: UpdateProductCategoryInput; actor: ActivityActor }): Promise<ProductCategory> {
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
      await this.productCategoryData?.update(nextData);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("A product category with this name already exists.");
      }
      throw error;
    }

    return ProductCategoryModel.toApi(this.productCategoryData?.toJSON());
  }

  protected async postExec(
    result: ProductCategory,
    context?: { uuid: string; input: UpdateProductCategoryInput; actor: ActivityActor },
  ): Promise<ProductCategory> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "update",
      entity: "product_category",
      entity_uuid: context?.uuid ?? result.uuid,
      origin: this.beforeData ?? null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}
