import Joi from "joi";
import { Op } from "sequelize";
import ProductModelFactory, { type Product } from "@/app/product/models/ProductModel";
import { UserModel } from "@/app/base/models/UserModel";
import { type ActivityActor } from "@/app/base/models/ActivityLogModel";
import { escapeLike } from "@/libraries/String";
import { BaseUseCase } from "@/useCases/BaseUseCase";

export type ListProductsFilter = {
  q?: string;
  sku?: string;
  name?: string;
  category_id?: string;
  unit_id?: string;
  status?: string;
  price_min?: number;
  price_max?: number;
};

export type ListProductsInput = {
  filter?: ListProductsFilter;
  sortProperty?: string;
  sortDirection?: string;
  offset?: unknown;
  limit?: unknown;
};

export type ListProductsQuery = {
  q?: string;
  sku?: string;
  name?: string;
  category_id?: string;
  unit_id?: string;
  status?: string;
  price_min?: number;
  price_max?: number;
  sortProperty: string;
  sortDirection: "ASC" | "DESC";
  offset: number;
  limit: number;
  actor: ActivityActor;
};

const SORTABLE_COLUMNS: Record<string, string> = {
  uuid: "uuid",
  sku: "sku",
  name: "name",
  base_price: "base_price",
  status: "status",
  created_at: "created_at",
  updated_at: "updated_at",
};

const listProductsSchema = Joi.object({
  filter: Joi.object({
    q: Joi.string().trim().allow("").optional(),
    sku: Joi.string().trim().allow("").optional(),
    name: Joi.string().trim().allow("").optional(),
    category_id: Joi.string().uuid({ version: "uuidv4" }).optional(),
    unit_id: Joi.string().uuid({ version: "uuidv4" }).optional(),
    status: Joi.string().trim().allow("").optional(),
    price_min: Joi.number().integer().min(0).optional(),
    price_max: Joi.number().integer().min(0).optional(),
  }).optional(),
  sortProperty: Joi.string()
    .valid(...Object.keys(SORTABLE_COLUMNS))
    .insensitive()
    .default("created_at"),
  sortDirection: Joi.string().valid("asc", "desc").insensitive().default("desc"),
  offset: Joi.number().integer().min(0).default(0),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export class ProductListUseCase extends BaseUseCase<ListProductsInput | void, Product[], ListProductsQuery> {
  protected async preExec(input?: ListProductsInput | void, actor?: ActivityActor): Promise<ListProductsQuery> {
    const validated = await this.validate<{
      filter?: ListProductsFilter;
      sortProperty: string;
      sortDirection: string;
      offset: number;
      limit: number;
    }>(listProductsSchema, input ?? {});
    const filter = validated.filter ?? {};

    return {
      q: filter.q?.trim() || undefined,
      sku: filter.sku?.trim().toUpperCase() || undefined,
      name: filter.name?.trim() || undefined,
      category_id: filter.category_id || undefined,
      unit_id: filter.unit_id || undefined,
      status: filter.status?.trim() || undefined,
      price_min: filter.price_min,
      price_max: filter.price_max,
      sortProperty: SORTABLE_COLUMNS[validated.sortProperty.toLowerCase()] ?? "created_at",
      sortDirection: validated.sortDirection.toUpperCase() as "ASC" | "DESC",
      offset: validated.offset,
      limit: validated.limit,
      actor: actor ?? null,
    };
  }

  private async applyOrganizationScope(
    conditions: Record<string, unknown>[],
    actor: ActivityActor,
  ): Promise<void> {
    const actorUuid = (actor as Record<string, unknown> | null)?.uuid;
    if (typeof actorUuid !== "string") {
      return;
    }

    const organization = await UserModel.resolveOrganization(actorUuid);
    if (!organization) {
      return;
    }

    conditions.push({ organization_id: organization.uuid });
  }

  protected async execute(context: ListProductsQuery): Promise<Product[]> {
    const ProductModel = await ProductModelFactory();
    const conditions: Record<string, unknown>[] = [{ deleted_at: null }];

    if (context.sku) {
      conditions.push({ sku: { [Op.iLike]: `%${escapeLike(context.sku)}%` } });
    }

    if (context.name) {
      conditions.push({ name: { [Op.iLike]: `%${escapeLike(context.name)}%` } });
    }

    if (context.category_id) {
      conditions.push({ category_id: context.category_id });
    }

    if (context.unit_id) {
      conditions.push({ unit_id: context.unit_id });
    }

    if (context.status) {
      conditions.push({ status: context.status });
    }

    if (typeof context.price_min === "number" && typeof context.price_max === "number") {
      conditions.push({ base_price: { [Op.gte]: context.price_min, [Op.lte]: context.price_max } });
    } else if (typeof context.price_min === "number") {
      conditions.push({ base_price: { [Op.gte]: context.price_min } });
    } else if (typeof context.price_max === "number") {
      conditions.push({ base_price: { [Op.lte]: context.price_max } });
    }

    if (context.q) {
      const pattern = `%${escapeLike(context.q)}%`;
      conditions.push({
        [Op.or]: [{ sku: { [Op.iLike]: pattern } }, { name: { [Op.iLike]: pattern } }],
      });
    }

    await this.applyOrganizationScope(conditions, context.actor);

    const rows = await ProductModel.findAll({
      where: { [Op.and]: conditions },
      order: [[context.sortProperty, context.sortDirection]],
      offset: context.offset,
      limit: context.limit,
    });

    return rows.map((row) => ProductModel.toApi(row.toJSON()));
  }
}
