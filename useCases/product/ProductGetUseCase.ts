import Joi from "joi";
import ProductModelFactory, { ProductModel, type Product } from "@/app/product/models/ProductModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const getProductSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).required(),
});

export class ProductGetUseCase extends BaseUseCase<string, Product | null, string> {

  private productData?: ProductModel | null;

  protected async preExec(uuid: string): Promise<string> {
    const validatedUuid = await this.validate<{ uuid: string }>(getProductSchema, { uuid });

    await ProductModelFactory();
    this.productData = await ProductModel.findOne({ where: { uuid: validatedUuid.uuid, deleted_at: null } });
    if (!this.productData) {
      throw new NotFoundException("Product not found")
    }

    return validatedUuid.uuid;
  }

  protected async execute(): Promise<Product | null> {
    return ProductModel.toApi(this.productData?.toJSON());
  }
}
