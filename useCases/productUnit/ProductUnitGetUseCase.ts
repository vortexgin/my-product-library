import Joi from "joi";
import ProductUnitModelFactory, { ProductUnitModel, type ProductUnit } from "@/app/product/models/ProductUnitModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const getProductUnitSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).required(),
});

export class ProductUnitGetUseCase extends BaseUseCase<string, ProductUnit | null, string> {

  private productUnitData?: ProductUnitModel | null;

  protected async preExec(uuid: string): Promise<string> {
    const validatedUuid = await this.validate<{ uuid: string }>(getProductUnitSchema, { uuid });

    await ProductUnitModelFactory();
    this.productUnitData = await ProductUnitModel.findOne({ where: { uuid: validatedUuid.uuid, deleted_at: null } });
    if (!this.productUnitData) {
      throw new NotFoundException("Product unit not found")
    }

    return validatedUuid.uuid;
  }

  protected async execute(): Promise<ProductUnit | null> {
    return ProductUnitModel.toApi(this.productUnitData?.toJSON());
  }
}
