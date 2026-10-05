import Joi from "joi";
import ProductModelFactory, { ProductModel, type Product } from "@/app/product/models/ProductModel";
import ProductVariantModelFactory, { ProductVariantModel } from "@/app/product/models/ProductVariantModel";
import ProductMetadataModelFactory, { ProductMetadataModel } from "@/app/product/models/ProductMetadataModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const deleteProductSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).required(),
});
export class ProductDeleteUseCase extends BaseUseCase<string, boolean, { uuid: string; actor: ActivityActor }> {

  private productData?: ProductModel | null;
  private beforeData?: Product | null;

  protected async preExec(uuid: string, actor?: ActivityActor): Promise<{ uuid: string; actor: ActivityActor }> {
    const validatedUuid = await this.validate<{ uuid: string }>(deleteProductSchema, { uuid });

    await ProductModelFactory();
    this.productData = await ProductModel.findOne({ where: { uuid: validatedUuid.uuid, deleted_at: null } });
    if (!this.productData) {
      throw new NotFoundException("Product not found")
    }
    this.beforeData = ProductModel.toApi(this.productData?.toJSON());
    return { uuid: validatedUuid.uuid, actor: actor ?? null };
  }

  protected async execute(context: { uuid: string; actor: ActivityActor }): Promise<boolean> {
    const { uuid } = context;
    await ProductModelFactory();
    const [affectedRows] = await ProductModel.update(
      {
        status: "deleted",
        deleted_at: new Date(),
        updated_at: new Date(),
      },
      {
        where: { uuid, deleted_at: null },
      },
    );
    if (affectedRows === 0) {
      return false;
    }

    // Cascade soft-delete, same use case, sequential: variants + all metadata.
    await ProductVariantModelFactory();
    await ProductVariantModel.update(
      { status: "deleted", deleted_at: new Date(), updated_at: new Date() },
      { where: { product_id: uuid, deleted_at: null } },
    );
    await ProductMetadataModelFactory();
    await ProductMetadataModel.update(
      { status: "deleted", deleted_at: new Date(), updated_at: new Date() },
      { where: { product_id: uuid, deleted_at: null } },
    );

    return true;
  }

  protected async postExec(
    result: boolean,
    context?: { uuid: string; actor: ActivityActor },
  ): Promise<boolean> {
    if (result) {
      void recordActivityLog({
        actor: context?.actor ?? null,
        operation: "delete",
        entity: "product",
        entity_uuid: context?.uuid ?? null,
        origin: this.beforeData ?? null,
        updated: null,
      });
    }
    return super.postExec(result, context);
  }
}
