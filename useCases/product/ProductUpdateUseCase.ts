import Joi from "joi";
import { Op, UniqueConstraintError } from "sequelize";
import ProductModelFactory, { ProductModel, type Product, type UpdateProductInput } from "@/app/product/models/ProductModel";
import ProductCategoryModelFactory, { ProductCategoryModel } from "@/app/product/models/ProductCategoryModel";
import ProductUnitModelFactory, { ProductUnitModel } from "@/app/product/models/ProductUnitModel";
import { syncProductMetadata, type MetadataNestedItem } from "@/app/product/libraries/productMetadataSync";
import { syncProductBom, type BomNestedItem } from "@/app/product/libraries/productBomSync";
import { UserModel } from "@/app/base/models/UserModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";
import NotFoundException from "@/exceptions/NotFoundException";

const metadataNestedSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).optional(),
  product_metadata_field_id: Joi.string().uuid({ version: "uuidv4" }).optional(),
  field_name: Joi.string().trim().min(2).max(160).optional(),
  variant_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  value: Joi.string().trim().min(1).required(),
});

const bomNestedSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).optional(),
  component_product_id: Joi.string().uuid({ version: "uuidv4" }).required(),
  component_variant_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  variant_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  qty: Joi.number().integer().min(1).required(),
});

const updateProductSchema = Joi.object({
  sku: Joi.string().trim().min(2).max(60).optional(),
  name: Joi.string().trim().min(2).max(160).optional(),
  description: Joi.string().trim().allow("", null).optional(),
  category_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  unit_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  base_price: Joi.number().integer().min(0).optional(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
  metadata: Joi.array().items(metadataNestedSchema).optional(),
  bom: Joi.array().items(bomNestedSchema).optional(),
}).unknown(false).min(1);

export class ProductUpdateUseCase extends BaseUseCase<string, Product, { uuid: string; input: UpdateProductInput; actor: ActivityActor }> {

  private productData?: ProductModel | null;
  private beforeData?: Product | null;

  protected async preExec(uuid: string, input: UpdateProductInput, actor?: ActivityActor): Promise<{ uuid: string; input: UpdateProductInput; actor: ActivityActor }> {
    const validatedInput = await this.validate<UpdateProductInput>(updateProductSchema, input);

    await ProductModelFactory();
    this.productData = await ProductModel.findOne({ where: { uuid, deleted_at: null } });
    if (!this.productData) {
      throw new NotFoundException("Product not found")
    }
    this.beforeData = ProductModel.toApi(this.productData?.toJSON());

    const actorUuid = (actor as Record<string, unknown> | null)?.uuid;
    const organizationId =
      typeof actorUuid === "string" ? ((await UserModel.resolveOrganization(actorUuid))?.uuid ?? null) : null;

    if (validatedInput.sku) {
      const skuTaken = await ProductModel.findOne({
        where: {
          sku: validatedInput.sku.trim().toUpperCase(),
          organization_id: this.beforeData?.organization_id ?? null,
          uuid: { [Op.ne]: uuid },
          deleted_at: null,
        },
      });
      if (skuTaken) {
        throw new DuplicateEntityException("A product with this SKU already exists.");
      }
    }

    if (validatedInput.category_id) {
      await ProductCategoryModelFactory();
      const category = await ProductCategoryModel.findOne({ where: { uuid: validatedInput.category_id, deleted_at: null } });
      if (!category || (organizationId && category.organization_id !== null && category.organization_id !== organizationId)) {
        throw new NotFoundException("Product category not found.");
      }
    }

    if (validatedInput.unit_id) {
      await ProductUnitModelFactory();
      const unit = await ProductUnitModel.findOne({ where: { uuid: validatedInput.unit_id, deleted_at: null } });
      if (!unit || (organizationId && unit.organization_id !== null && unit.organization_id !== organizationId)) {
        throw new NotFoundException("Product unit not found.");
      }
    }

    return { uuid, input: validatedInput, actor: actor ?? null };
  }

  protected async execute(context: { uuid: string; input: UpdateProductInput; actor: ActivityActor }): Promise<Product> {
    const { uuid, input, actor } = context;
    const nextData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (typeof input.sku === "string" && input.sku.trim()) {
      nextData.sku = input.sku.trim().toUpperCase();
    }

    if (typeof input.name === "string" && input.name.trim()) {
      nextData.name = input.name.trim();
    }

    if (Object.prototype.hasOwnProperty.call(input, "description")) {
      nextData.description = input.description?.trim() || null;
    }

    if (Object.prototype.hasOwnProperty.call(input, "category_id")) {
      nextData.category_id = input.category_id ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(input, "unit_id")) {
      nextData.unit_id = input.unit_id ?? null;
    }

    if (typeof input.base_price === "number") {
      nextData.base_price = input.base_price;
    }

    if (input.status) {
      nextData.status = input.status;
      if (input.status === "deleted") {
        nextData.deleted_at = new Date();
      } else {
        nextData.deleted_at = null;
      }
    }

    try {
      await this.productData?.update(nextData);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("A product with this SKU already exists.");
      }
      throw error;
    }

    // Full-replacement sync, product scope only — variant rows untouched.
    if (Object.prototype.hasOwnProperty.call(input, "metadata")) {
      const api = ProductModel.toApi(this.productData?.toJSON());
      await syncProductMetadata(
        uuid,
        null,
        (input.metadata as MetadataNestedItem[] | undefined)?.map((item) => ({ ...item, variant_id: null })),
        api.organization_id,
        actor,
      );
    }

    // Full-replacement BoM sync (all scopes); omitted rows soft-delete.
    if (Object.prototype.hasOwnProperty.call(input, "bom")) {
      const api = ProductModel.toApi(this.productData?.toJSON());
      await syncProductBom(uuid, input.bom as BomNestedItem[] | undefined, api.organization_id, actor);
    }

    return ProductModel.toApi(this.productData?.toJSON());
  }

  protected async postExec(
    result: Product,
    context?: { uuid: string; input: UpdateProductInput; actor: ActivityActor },
  ): Promise<Product> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "update",
      entity: "product",
      entity_uuid: context?.uuid ?? result.uuid,
      origin: this.beforeData ?? null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}
