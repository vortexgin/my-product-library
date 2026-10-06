import Joi from "joi";
import { Op } from "sequelize";
import ProductModelFactory, { ProductModel, type Product, type ProductBomLine } from "@/app/product/models/ProductModel";
import ProductBomModelFactory, { ProductBomModel } from "@/app/product/models/ProductBomModel";
import ProductVariantModelFactory, { ProductVariantModel } from "@/app/product/models/ProductVariantModel";
import ProductCategoryModelFactory, { ProductCategoryModel } from "@/app/product/models/ProductCategoryModel";
import ProductUnitModelFactory, { ProductUnitModel } from "@/app/product/models/ProductUnitModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";
import NotFoundException from "@/exceptions/NotFoundException";

const getProductSchema = Joi.object({
  uuid: Joi.string().uuid({ version: "uuidv4" }).required(),
});

/**
 * Relation labels come from eager-loaded associations, not stored snapshots.
 * Association setup is best-effort: a failure degrades to a plain row read
 * with null relations instead of failing the lookup.
 */
async function buildRelationIncludes(): Promise<any[]> {
  try {
    await Promise.all([ProductCategoryModelFactory(), ProductUnitModelFactory()]);
    const associations = (ProductModel as any).associations ?? {};
    if (!associations.category) {
      ProductModel.belongsTo(ProductCategoryModel, {
        foreignKey: "category_id",
        targetKey: "uuid",
        as: "category",
        constraints: false,
      });
    }
    if (!associations.unit) {
      ProductModel.belongsTo(ProductUnitModel, {
        foreignKey: "unit_id",
        targetKey: "uuid",
        as: "unit",
        constraints: false,
      });
    }
    return [
      { model: ProductCategoryModel, as: "category", required: false },
      { model: ProductUnitModel, as: "unit", required: false },
    ];
  } catch {
    return [];
  }
}

export class ProductGetUseCase extends BaseUseCase<string, Product | null, string> {

  private productData?: ProductModel | null;

  /**
   * BoM lines for one product with display labels. Best-effort: any failure
   * degrades to an empty list instead of failing the lookup (labels fall back
   * to UUIDs on the page).
   */
  private async buildBomLines(productUuid: string): Promise<ProductBomLine[]> {
    try {
      await Promise.all([ProductBomModelFactory(), ProductModelFactory(), ProductVariantModelFactory()]);
      const rows = await ProductBomModel.findAll({
        where: { product_id: productUuid, deleted_at: null },
        order: [["created_at", "ASC"]],
      });
      if (rows.length === 0) {
        return [];
      }
      const componentIds = [...new Set(rows.map((row) => row.component_product_id))];
      const variantIds = [
        ...new Set(
          rows.flatMap((row) => [row.variant_id, row.component_variant_id]).filter((id): id is string => !!id),
        ),
      ];
      const [components, variants] = await Promise.all([
        ProductModel.findAll({ where: { uuid: { [Op.in]: componentIds } } }).catch(() => []),
        variantIds.length > 0
          ? ProductVariantModel.findAll({ where: { uuid: { [Op.in]: variantIds } } }).catch(() => [])
          : [],
      ]);
      const componentByUuid = new Map(components.map((item) => [item.uuid, item]));
      const variantByUuid = new Map(variants.map((item) => [item.uuid, item]));
      return rows.map((row) => {
        const component = componentByUuid.get(row.component_product_id);
        const scopeVariant = row.variant_id ? variantByUuid.get(row.variant_id) : undefined;
        const componentVariant = row.component_variant_id ? variantByUuid.get(row.component_variant_id) : undefined;
        return {
          uuid: row.uuid,
          variant_id: row.variant_id ?? null,
          component_product_id: row.component_product_id,
          component_variant_id: row.component_variant_id ?? null,
          qty: row.qty,
          status: row.status,
          component_sku: component?.sku ?? null,
          component_name: component?.name ?? null,
          variant_name: scopeVariant?.name ?? null,
          component_variant_name: componentVariant?.name ?? null,
        };
      });
    } catch {
      return [];
    }
  }

  protected async preExec(uuid: string): Promise<string> {
    const validatedUuid = await this.validate<{ uuid: string }>(getProductSchema, { uuid });

    await ProductModelFactory();
    this.productData = await ProductModel.findOne({
      where: { uuid: validatedUuid.uuid, deleted_at: null },
      include: await buildRelationIncludes(),
    });
    if (!this.productData) {
      throw new NotFoundException("Product not found")
    }

    return validatedUuid.uuid;
  }

  protected async execute(uuid: string): Promise<Product | null> {
    const bom = await this.buildBomLines(uuid);
    return ProductModel.toApi({ ...this.productData?.toJSON(), bom });
  }
}
