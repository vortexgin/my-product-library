import { randomUUID } from "crypto";
import Joi from "joi";
import { UniqueConstraintError } from "sequelize";
import ProductModelFactory, { ProductModel, type CreateProductInput, type Product } from "@/app/product/models/ProductModel";
import ProductCategoryModelFactory, { ProductCategoryModel } from "@/app/product/models/ProductCategoryModel";
import ProductUnitModelFactory, { ProductUnitModel } from "@/app/product/models/ProductUnitModel";
import { ensurePcsUnit } from "@/app/product/useCases/productUnit/ProductUnitCreateUseCase";
import { syncProductMetadata, type MetadataNestedItem } from "@/app/product/useCases/product/productMetadataSync";
import { syncProductBom, type BomNestedItem } from "@/app/product/useCases/product/productBomSync";
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

const createProductSchema = Joi.object({
  sku: Joi.string().trim().min(2).max(60).required(),
  name: Joi.string().trim().min(2).max(160).required(),
  description: Joi.string().trim().allow("", null).optional(),
  category_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  unit_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  base_price: Joi.number().integer().min(0).required(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
  metadata: Joi.array().items(metadataNestedSchema).optional(),
  bom: Joi.array().items(bomNestedSchema).optional(),
}).unknown(false);

export type ProductCreateContext = { input: CreateProductInput; actor: ActivityActor; organizationId: string | null };

export class ProductCreateUseCase extends BaseUseCase<CreateProductInput, Product, ProductCreateContext> {
  protected async preExec(input: CreateProductInput, actor?: ActivityActor): Promise<ProductCreateContext> {
    const validated = await this.validate<CreateProductInput>(createProductSchema, input);

    const actorUuid = (actor as Record<string, unknown> | null)?.uuid;
    const organizationId =
      typeof actorUuid === "string" ? ((await UserModel.resolveOrganization(actorUuid))?.uuid ?? null) : null;

    await ProductModelFactory();
    const existingProduct = await ProductModel.findOne({
      where: { sku: validated.sku.trim().toUpperCase(), organization_id: organizationId, deleted_at: null },
    });
    if (existingProduct) {
      throw new DuplicateEntityException("A product with this SKU already exists.");
    }

    if (validated.category_id) {
      await ProductCategoryModelFactory();
      const category = await ProductCategoryModel.findOne({ where: { uuid: validated.category_id, deleted_at: null } });
      if (!category || (organizationId && category.organization_id !== null && category.organization_id !== organizationId)) {
        throw new NotFoundException("Product category not found.");
      }
    }

    if (validated.unit_id) {
      await ProductUnitModelFactory();
      const unit = await ProductUnitModel.findOne({ where: { uuid: validated.unit_id, deleted_at: null } });
      if (!unit || (organizationId && unit.organization_id !== null && unit.organization_id !== organizationId)) {
        throw new NotFoundException("Product unit not found.");
      }
    }

    return { input: validated, actor: actor ?? null, organizationId };
  }

  protected async execute(context: ProductCreateContext): Promise<Product> {
    const { input, organizationId, actor } = context;
    await ProductModelFactory();

    let unitId = input.unit_id ?? null;
    if (!unitId) {
      unitId = (await ensurePcsUnit(organizationId, actor)).uuid;
    }

    try {
      const product = await ProductModel.create({
        uuid: randomUUID(),
        organization_id: organizationId ?? null,
        sku: input.sku.trim().toUpperCase(),
        name: input.name?.trim(),
        description: input.description?.trim() || null,
        category_id: input.category_id ?? null,
        unit_id: unitId,
        base_price: input.base_price,
        status: input.status ?? "active",
        deleted_at: null,
      });

      const api = ProductModel.toApi(product.toJSON());
      // Product-level rows only; variant rows arrive via variant payloads.
      await syncProductMetadata(
        api.uuid,
        null,
        (input.metadata as MetadataNestedItem[] | undefined)?.map((item) => ({ ...item, variant_id: null })),
        organizationId,
        actor,
      );
      // Bill of materials, managed nested here (no direct BoM API).
      await syncProductBom(api.uuid, input.bom as BomNestedItem[] | undefined, organizationId, actor);
      return api;
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("A product with this SKU already exists.");
      }
      throw error;
    }
  }

  protected async postExec(result: Product, context?: ProductCreateContext): Promise<Product> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "create",
      entity: "product",
      entity_uuid: result.uuid,
      origin: null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}
