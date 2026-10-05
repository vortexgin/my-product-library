import Joi from "joi";
import ProductCategoryModelFactory, { ProductCategoryModel, type ProductCategory } from "@/app/product/models/ProductCategoryModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const deleteProductCategorySchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).required(),
});
export class ProductCategoryDeleteUseCase extends BaseUseCase<string, boolean, { uuid: string; actor: ActivityActor }> {

  private productCategoryData?: ProductCategoryModel | null;
  private beforeData?: ProductCategory | null;

  protected async preExec(uuid: string, actor?: ActivityActor): Promise<{ uuid: string; actor: ActivityActor }> {
    const validatedUuid = await this.validate<{ uuid: string }>(deleteProductCategorySchema, { uuid });

    await ProductCategoryModelFactory();
    this.productCategoryData = await ProductCategoryModel.findOne({ where: { uuid: validatedUuid.uuid, deleted_at: null } });
    if (!this.productCategoryData) {
      throw new NotFoundException("Product category not found")
    }
    this.beforeData = ProductCategoryModel.toApi(this.productCategoryData?.toJSON());
    return { uuid: validatedUuid.uuid, actor: actor ?? null };
  }

  protected async execute(context: { uuid: string; actor: ActivityActor }): Promise<boolean> {
    const { uuid } = context;
    await ProductCategoryModelFactory();
    const [affectedRows] = await ProductCategoryModel.update(
      {
        status: "deleted",
        deleted_at: new Date(),
        updated_at: new Date(),
      },
      {
        where: { uuid, deleted_at: null },
      },
    );

    return affectedRows > 0;
  }

  protected async postExec(
    result: boolean,
    context?: { uuid: string; actor: ActivityActor },
  ): Promise<boolean> {
    if (result) {
      void recordActivityLog({
        actor: context?.actor ?? null,
        operation: "delete",
        entity: "product_category",
        entity_uuid: context?.uuid ?? null,
        origin: this.beforeData ?? null,
        updated: null,
      });
    }
    return super.postExec(result, context);
  }
}
