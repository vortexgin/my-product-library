import Joi from "joi";
import ProductVariantModelFactory, { ProductVariantModel, type ProductVariant } from "@/app/product/models/ProductVariantModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const getProductVariantSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).required(),
});

export class ProductVariantGetUseCase extends BaseUseCase<string, ProductVariant | null, string> {

  private productVariantData?: ProductVariantModel | null;

  protected async preExec(uuid: string): Promise<string> {
    const validatedUuid = await this.validate<{ uuid: string }>(getProductVariantSchema, { uuid });

    await ProductVariantModelFactory();
    this.productVariantData = await ProductVariantModel.findOne({ where: { uuid: validatedUuid.uuid, deleted_at: null } });
    if (!this.productVariantData) {
      throw new NotFoundException("Product variant not found")
    }

    return validatedUuid.uuid;
  }

  protected async execute(): Promise<ProductVariant | null> {
    return ProductVariantModel.toApi(this.productVariantData?.toJSON());
  }
}
