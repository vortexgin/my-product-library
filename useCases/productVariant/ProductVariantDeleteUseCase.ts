import Joi from "joi";
import ProductVariantModelFactory, { ProductVariantModel, type ProductVariant } from "@/app/product/models/ProductVariantModel";
import ProductMetadataModelFactory, { ProductMetadataModel } from "@/app/product/models/ProductMetadataModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const deleteProductVariantSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).required(),
});
export class ProductVariantDeleteUseCase extends BaseUseCase<string, boolean, { uuid: string; actor: ActivityActor }> {

  private productVariantData?: ProductVariantModel | null;
  private beforeData?: ProductVariant | null;

  protected async preExec(uuid: string, actor?: ActivityActor): Promise<{ uuid: string; actor: ActivityActor }> {
    const validatedUuid = await this.validate<{ uuid: string }>(deleteProductVariantSchema, { uuid });

    await ProductVariantModelFactory();
    this.productVariantData = await ProductVariantModel.findOne({ where: { uuid: validatedUuid.uuid, deleted_at: null } });
    if (!this.productVariantData) {
      throw new NotFoundException("Product variant not found")
    }
    this.beforeData = ProductVariantModel.toApi(this.productVariantData?.toJSON());
    return { uuid: validatedUuid.uuid, actor: actor ?? null };
  }

  protected async execute(context: { uuid: string; actor: ActivityActor }): Promise<boolean> {
    const { uuid } = context;
    await ProductVariantModelFactory();
    const [affectedRows] = await ProductVariantModel.update(
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

    // Soft-delete this variant's metadata rows as well.
    await ProductMetadataModelFactory();
    await ProductMetadataModel.update(
      { status: "deleted", deleted_at: new Date(), updated_at: new Date() },
      { where: { variant_id: uuid, deleted_at: null } },
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
        entity: "product_variant",
        entity_uuid: context?.uuid ?? null,
        origin: this.beforeData ?? null,
        updated: null,
      });
    }
    return super.postExec(result, context);
  }
}
