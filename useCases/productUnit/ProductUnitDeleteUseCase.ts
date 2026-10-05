import Joi from "joi";
import ProductUnitModelFactory, { ProductUnitModel, type ProductUnit } from "@/app/product/models/ProductUnitModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const deleteProductUnitSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).required(),
});
export class ProductUnitDeleteUseCase extends BaseUseCase<string, boolean, { uuid: string; actor: ActivityActor }> {

  private productUnitData?: ProductUnitModel | null;
  private beforeData?: ProductUnit | null;

  protected async preExec(uuid: string, actor?: ActivityActor): Promise<{ uuid: string; actor: ActivityActor }> {
    const validatedUuid = await this.validate<{ uuid: string }>(deleteProductUnitSchema, { uuid });

    await ProductUnitModelFactory();
    this.productUnitData = await ProductUnitModel.findOne({ where: { uuid: validatedUuid.uuid, deleted_at: null } });
    if (!this.productUnitData) {
      throw new NotFoundException("Product unit not found")
    }
    this.beforeData = ProductUnitModel.toApi(this.productUnitData?.toJSON());
    return { uuid: validatedUuid.uuid, actor: actor ?? null };
  }

  protected async execute(context: { uuid: string; actor: ActivityActor }): Promise<boolean> {
    const { uuid } = context;
    await ProductUnitModelFactory();
    const [affectedRows] = await ProductUnitModel.update(
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
        entity: "product_unit",
        entity_uuid: context?.uuid ?? null,
        origin: this.beforeData ?? null,
        updated: null,
      });
    }
    return super.postExec(result, context);
  }
}
