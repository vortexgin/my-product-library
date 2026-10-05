import Joi from "joi";
import ProductMetadataFieldModelFactory, { ProductMetadataFieldModel, type ProductMetadataField } from "@/app/product/models/ProductMetadataFieldModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const getProductMetadataFieldSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).required(),
});

export class ProductMetadataFieldGetUseCase extends BaseUseCase<string, ProductMetadataField | null, string> {

  private productMetadataFieldData?: ProductMetadataFieldModel | null;

  protected async preExec(uuid: string): Promise<string> {
    const validatedUuid = await this.validate<{ uuid: string }>(getProductMetadataFieldSchema, { uuid });

    await ProductMetadataFieldModelFactory();
    this.productMetadataFieldData = await ProductMetadataFieldModel.findOne({ where: { uuid: validatedUuid.uuid, deleted_at: null } });
    if (!this.productMetadataFieldData) {
      throw new NotFoundException("Product metadata field not found")
    }

    return validatedUuid.uuid;
  }

  protected async execute(): Promise<ProductMetadataField | null> {
    return ProductMetadataFieldModel.toApi(this.productMetadataFieldData?.toJSON());
  }
}
