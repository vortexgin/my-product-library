import Joi from "joi";
import { Op, UniqueConstraintError } from "sequelize";
import ProductUnitModelFactory, { ProductUnitModel, type ProductUnit, type UpdateProductUnitInput } from "@/app/product/models/ProductUnitModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";
import NotFoundException from "@/exceptions/NotFoundException";

const updateProductUnitSchema = Joi.object({
  name: Joi.string().trim().min(1).max(160).optional(),
  symbol: Joi.string().trim().min(1).max(10).optional(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
}).min(1);

export class ProductUnitUpdateUseCase extends BaseUseCase<string, ProductUnit, { uuid: string; input: UpdateProductUnitInput; actor: ActivityActor }> {

  private productUnitData?: ProductUnitModel | null;
  private beforeData?: ProductUnit | null;

  protected async preExec(uuid: string, input: UpdateProductUnitInput, actor?: ActivityActor): Promise<{ uuid: string; input: UpdateProductUnitInput; actor: ActivityActor }> {
    const validatedInput = await this.validate<UpdateProductUnitInput>(updateProductUnitSchema, input);

    await ProductUnitModelFactory();
    this.productUnitData = await ProductUnitModel.findOne({ where: { uuid, deleted_at: null } });
    if (!this.productUnitData) {
      throw new NotFoundException("Product unit not found")
    }
    this.beforeData = ProductUnitModel.toApi(this.productUnitData?.toJSON());

    if (validatedInput.name?.trim()) {
      const nameTaken = await ProductUnitModel.findOne({
        where: {
          organization_id: this.beforeData?.organization_id ?? null,
          name: validatedInput.name.trim(),
          uuid: { [Op.ne]: uuid },
          deleted_at: null,
        },
      });
      if (nameTaken) {
        throw new DuplicateEntityException("A product unit with this name already exists.");
      }
    }

    return { uuid, input: validatedInput, actor: actor ?? null };
  }

  protected async execute(context: { uuid: string; input: UpdateProductUnitInput; actor: ActivityActor }): Promise<ProductUnit> {
    const { input } = context;
    const nextData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (typeof input.name === "string" && input.name.trim()) {
      nextData.name = input.name.trim();
    }

    if (typeof input.symbol === "string" && input.symbol.trim()) {
      nextData.symbol = input.symbol.trim();
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
      await this.productUnitData?.update(nextData);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("A product unit with this name already exists.");
      }
      throw error;
    }

    return ProductUnitModel.toApi(this.productUnitData?.toJSON());
  }

  protected async postExec(
    result: ProductUnit,
    context?: { uuid: string; input: UpdateProductUnitInput; actor: ActivityActor },
  ): Promise<ProductUnit> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "update",
      entity: "product_unit",
      entity_uuid: context?.uuid ?? result.uuid,
      origin: this.beforeData ?? null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}
