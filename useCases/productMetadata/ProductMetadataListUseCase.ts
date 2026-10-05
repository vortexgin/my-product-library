import Joi from "joi";
import ProductMetadataModelFactory, { type ProductMetadata } from "@/app/product/models/ProductMetadataModel";
import { BaseUseCase } from "@/useCases/BaseUseCase";

export type ListProductMetadataFilter = {
  product_id?: string;
  variant_id?: string;
};

export type ListProductMetadataInput = {
  filter?: ListProductMetadataFilter;
  sortProperty?: string;
  sortDirection?: string;
  offset?: unknown;
  limit?: unknown;
};

export type ListProductMetadataQuery = {
  product_id?: string;
  variant_id?: string;
  sortProperty: string;
  sortDirection: "ASC" | "DESC";
  offset: number;
  limit: number;
};

const SORTABLE_COLUMNS: Record<string, string> = {
  uuid: "uuid",
  created_at: "created_at",
  updated_at: "updated_at",
};

const listProductMetadataSchema = Joi.object({
  filter: Joi.object({
    product_id: Joi.string().uuid({ version: "uuidv4" }).optional(),
    variant_id: Joi.string().uuid({ version: "uuidv4" }).allow(null).optional(),
  }).optional(),
  sortProperty: Joi.string()
    .valid(...Object.keys(SORTABLE_COLUMNS))
    .insensitive()
    .default("created_at"),
  sortDirection: Joi.string().valid("asc", "desc").insensitive().default("desc"),
  offset: Joi.number().integer().min(0).default(0),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export class ProductMetadataListUseCase extends BaseUseCase<ListProductMetadataInput | void, ProductMetadata[], ListProductMetadataQuery> {
  protected async preExec(input?: ListProductMetadataInput | void): Promise<ListProductMetadataQuery> {
    const validated = await this.validate<{
      filter?: ListProductMetadataFilter;
      sortProperty: string;
      sortDirection: string;
      offset: number;
      limit: number;
    }>(listProductMetadataSchema, input ?? {});
    const filter = validated.filter ?? {};

    return {
      product_id: filter.product_id || undefined,
      variant_id: filter.variant_id || undefined,
      sortProperty: SORTABLE_COLUMNS[validated.sortProperty.toLowerCase()] ?? "created_at",
      sortDirection: validated.sortDirection.toUpperCase() as "ASC" | "DESC",
      offset: validated.offset,
      limit: validated.limit,
    };
  }

  protected async execute(context: ListProductMetadataQuery): Promise<ProductMetadata[]> {
    const ProductMetadataModel = await ProductMetadataModelFactory();
    const conditions: Record<string, unknown> = { deleted_at: null };

    if (context.product_id) {
      conditions.product_id = context.product_id;
    }

    if (context.variant_id) {
      conditions.variant_id = context.variant_id;
    }

    const rows = await ProductMetadataModel.findAll({
      where: conditions,
      order: [[context.sortProperty, context.sortDirection]],
      offset: context.offset,
      limit: context.limit,
    });

    return rows.map((row) => ProductMetadataModel.toApi(row.toJSON()));
  }
}
