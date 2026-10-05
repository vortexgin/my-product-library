import Joi from "joi";
import ProductCategoryModelFactory, { ProductCategoryModel, type ProductCategory } from "@/app/product/models/ProductCategoryModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const getProductCategorySchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).required(),
});

export class ProductCategoryGetUseCase extends BaseUseCase<string, ProductCategory | null, string> {

  private productCategoryData?: ProductCategoryModel | null;

  protected async preExec(uuid: string): Promise<string> {
    const validatedUuid = await this.validate<{ uuid: string }>(getProductCategorySchema, { uuid });

    await ProductCategoryModelFactory();
    this.productCategoryData = await ProductCategoryModel.findOne({ where: { uuid: validatedUuid.uuid, deleted_at: null } });
    if (!this.productCategoryData) {
      throw new NotFoundException("Product category not found")
    }

    return validatedUuid.uuid;
  }

  protected async execute(): Promise<ProductCategory | null> {
    return ProductCategoryModel.toApi(this.productCategoryData?.toJSON());
  }
}
