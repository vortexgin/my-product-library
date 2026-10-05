import { randomUUID } from "crypto";
import Joi from "joi";
import { UniqueConstraintError } from "sequelize";
import ProductCategoryModelFactory, { ProductCategoryModel, type CreateProductCategoryInput, type ProductCategory } from "@/app/product/models/ProductCategoryModel";
import { UserModel } from "@/app/base/models/UserModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";

const createProductCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(160).required(),
  description: Joi.string().trim().min(2).required(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
});

export class ProductCategoryCreateUseCase extends BaseUseCase<CreateProductCategoryInput, ProductCategory, { input: CreateProductCategoryInput; actor: ActivityActor; organizationId: string | null }> {
  protected async preExec(input: CreateProductCategoryInput, actor?: ActivityActor): Promise<{ input: CreateProductCategoryInput; actor: ActivityActor; organizationId: string | null }> {
    const validated = await this.validate<CreateProductCategoryInput>(createProductCategorySchema, input);

    const actorUuid = (actor as Record<string, unknown> | null)?.uuid;
    const organizationId =
      typeof actorUuid === "string" ? ((await UserModel.resolveOrganization(actorUuid))?.uuid ?? null) : null;

    await ProductCategoryModelFactory();
    const existingRow = await ProductCategoryModel.findOne({
      where: { organization_id: organizationId, name: validated.name.trim(), deleted_at: null },
    });
    if (existingRow) {
      throw new DuplicateEntityException("A product category with this name already exists.");
    }

    return { input: validated, actor: actor ?? null, organizationId };
  }

  protected async execute(context: { input: CreateProductCategoryInput; actor: ActivityActor; organizationId: string | null }): Promise<ProductCategory> {
    const { input, organizationId } = context;
    await ProductCategoryModelFactory();
    try {
      const row = await ProductCategoryModel.create({
        uuid: randomUUID(),
        organization_id: organizationId ?? null,
        name: input.name?.trim(),
        description: input.description?.trim(),
        status: input.status ?? "active",
        deleted_at: null,
      });

      return ProductCategoryModel.toApi(row.toJSON());
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("A product category with this name already exists.");
      }
      throw error;
    }
  }

  protected async postExec(
    result: ProductCategory,
    context?: { input: CreateProductCategoryInput; actor: ActivityActor; organizationId: string | null },
  ): Promise<ProductCategory> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "create",
      entity: "product_category",
      entity_uuid: result.uuid,
      origin: null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}
