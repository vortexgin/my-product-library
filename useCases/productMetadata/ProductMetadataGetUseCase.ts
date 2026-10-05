import Joi from "joi";
import ProductMetadataModelFactory, { ProductMetadataModel, type ProductMetadata } from "@/app/product/models/ProductMetadataModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const getProductMetadataSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).required(),
});

export class ProductMetadataGetUseCase extends BaseUseCase<string, ProductMetadata | null, string> {

  private productMetadataData?: ProductMetadataModel | null;

  protected async preExec(uuid: string): Promise<string> {
    const validatedUuid = await this.validate<{ uuid: string }>(getProductMetadataSchema, { uuid });

    await ProductMetadataModelFactory();
    this.productMetadataData = await ProductMetadataModel.findOne({ where: { uuid: validatedUuid.uuid, deleted_at: null } });
    if (!this.productMetadataData) {
      throw new NotFoundException("Product metadata not found")
    }

    return validatedUuid.uuid;
  }

  protected async execute(): Promise<ProductMetadata | null> {
    return ProductMetadataModel.toApi(this.productMetadataData?.toJSON());
  }
}
