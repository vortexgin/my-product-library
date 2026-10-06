import { randomUUID } from "crypto";
import Joi from "joi";
import { UniqueConstraintError } from "sequelize";
import ProductVariantModelFactory, { ProductVariantModel, type CreateProductVariantInput, type ProductVariant } from "@/app/product/models/ProductVariantModel";
import ProductModelFactory, { ProductModel } from "@/app/product/models/ProductModel";
import { syncProductMetadata, type MetadataNestedItem } from "@/app/product/libraries/productMetadataSync";
import { UserModel } from "@/app/base/models/UserModel";
import { recordActivityLog, type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import DuplicateEntityException from "@/exceptions/DuplicateEntityException";
import ForbiddenException from "@/exceptions/ForbiddenException";
import NotFoundException from "@/exceptions/NotFoundException";

const metadataNestedSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).optional(),
  product_metadata_field_id: Joi.string().uuid({ version: "uuidv4" }).optional(),
  field_name: Joi.string().trim().min(2).max(160).optional(),
  variant_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  value: Joi.string().trim().min(1).required(),
});

const createProductVariantSchema = Joi.object({
  product_id: Joi.string().uuid({ version: "uuidv4" }).required(),
  sku: Joi.string().trim().min(2).max(60).required(),
  name: Joi.string().trim().min(2).max(160).required(),
  price_override: Joi.number().integer().min(0).allow(null).optional(),
  status: Joi.string().valid("active", "inactive", "deleted").optional(),
  metadata: Joi.array().items(metadataNestedSchema).optional(),
}).unknown(false);

export type ProductVariantCreateContext = {
  input: CreateProductVariantInput & { metadata?: MetadataNestedItem[] };
  actor: ActivityActor;
  organizationId: string | null;
};

export class ProductVariantCreateUseCase extends BaseUseCase<CreateProductVariantInput, ProductVariant, ProductVariantCreateContext> {
  protected async preExec(input: CreateProductVariantInput, actor?: ActivityActor): Promise<ProductVariantCreateContext> {
    const validated = await this.validate<CreateProductVariantInput & { metadata?: MetadataNestedItem[] }>(createProductVariantSchema, input);

    const actorUuid = (actor as Record<string, unknown> | null)?.uuid;
    const organizationId =
      typeof actorUuid === "string" ? ((await UserModel.resolveOrganization(actorUuid))?.uuid ?? null) : null;

    await ProductModelFactory();
    const product = await ProductModel.findOne({ where: { uuid: validated.product_id, deleted_at: null } });
    if (!product) {
      throw new NotFoundException("Product not found.");
    }
    if ((product.organization_id ?? null) !== organizationId) {
      throw new ForbiddenException("Product belongs to another organization.");
    }

    await ProductVariantModelFactory();
    const existingVariant = await ProductVariantModel.findOne({
      where: { sku: validated.sku.trim().toUpperCase(), organization_id: organizationId, deleted_at: null },
    });
    if (existingVariant) {
      throw new DuplicateEntityException("A product variant with this SKU already exists.");
    }

    return { input: validated, actor: actor ?? null, organizationId };
  }

  protected async execute(context: ProductVariantCreateContext): Promise<ProductVariant> {
    const { input, organizationId, actor } = context;
    await ProductVariantModelFactory();
    try {
      const variant = await ProductVariantModel.create({
        uuid: randomUUID(),
        product_id: input.product_id,
        organization_id: organizationId ?? null,
        sku: input.sku.trim().toUpperCase(),
        name: input.name?.trim(),
        price_override: typeof input.price_override === "number" ? input.price_override : null,
        status: input.status ?? "active",
        deleted_at: null,
      });

      const api = ProductVariantModel.toApi(variant.toJSON());
      // Variant-level rows only; product-level rows arrive via product payloads.
      await syncProductMetadata(
        input.product_id,
        api.uuid,
        input.metadata?.map((item) => ({ ...item, variant_id: api.uuid })),
        organizationId,
        actor,
      );
      return api;
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DuplicateEntityException("A product variant with this SKU already exists.");
      }
      throw error;
    }
  }

  protected async postExec(result: ProductVariant, context?: ProductVariantCreateContext): Promise<ProductVariant> {
    void recordActivityLog({
      actor: context?.actor ?? null,
      operation: "create",
      entity: "product_variant",
      entity_uuid: result.uuid,
      origin: null,
      updated: result,
    });
    return super.postExec(result, context);
  }
}
