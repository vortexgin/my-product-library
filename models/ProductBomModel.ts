import { DataTypes, Model } from "sequelize";
import { getSequelizeInstance } from "@/database/sequelize";

export type ProductBomStatus = "active" | "inactive" | "deleted";

/**
 * Bill of materials row. An `out` movement of (product_id, variant_id)
 * consumes `qty` units of the component per 1 parent unit issued.
 * `variant_id` NULL = applies to all variants of the parent; a
 * variant-specific row set overrides the generic set (never both).
 * Managed nested via the product API only — no direct CRUD routes.
 */
export type ProductBom = {
  uuid: string;
  organization_id: string | null;
  product_id: string;
  variant_id: string | null;
  component_product_id: string;
  component_variant_id: string | null;
  qty: number;
  status: ProductBomStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreateProductBomInput = {
  product_id: string;
  variant_id?: string | null;
  component_product_id: string;
  component_variant_id?: string | null;
  qty: number;
  status?: ProductBomStatus;
};

export type UpdateProductBomInput = Partial<CreateProductBomInput>;

export type ProductBomModelAttributes = Partial<Omit<ProductBom, "created_at" | "updated_at" | "deleted_at">> & {
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type ProductBomModelCreationAttributes = Partial<ProductBomModelAttributes>;

export class ProductBomModel extends Model<ProductBomModelAttributes, ProductBomModelCreationAttributes> {
  declare uuid: string;
  declare organization_id: string | null;
  declare product_id: string;
  declare variant_id: string | null;
  declare component_product_id: string;
  declare component_variant_id: string | null;
  declare qty: number;
  declare status: ProductBomStatus;
  declare created_at: Date;
  declare updated_at: Date;
  declare deleted_at: Date | null;

  static toApi(row: any): ProductBom {
    return {
      uuid: row.uuid,
      organization_id: row.organization_id ?? null,
      product_id: row.product_id,
      variant_id: row.variant_id ?? null,
      component_product_id: row.component_product_id,
      component_variant_id: row.component_variant_id ?? null,
      qty: typeof row.qty === "number" ? row.qty : 0,
      status: row.status,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    };
  }
}

let productBomModelPromise: Promise<typeof ProductBomModel> | null = null;

export async function getProductBomModel(): Promise<typeof ProductBomModel> {
  if ((ProductBomModel as any).initialized) {
    return ProductBomModel;
  }
  if (!productBomModelPromise) {
    productBomModelPromise = initProductBomModel().catch((error) => {
      productBomModelPromise = null;
      throw error;
    });
  }
  return productBomModelPromise;
}

async function initProductBomModel(): Promise<typeof ProductBomModel> {
  const sequelize = await getSequelizeInstance();

  {
    ProductBomModel.init(
      {
        uuid: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        organization_id: {
          type: DataTypes.UUID,
          allowNull: true,
          defaultValue: null,
        },
        product_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        variant_id: {
          type: DataTypes.UUID,
          allowNull: true,
          defaultValue: null,
        },
        component_product_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        component_variant_id: {
          type: DataTypes.UUID,
          allowNull: true,
          defaultValue: null,
        },
        qty: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM("active", "inactive", "deleted"),
          allowNull: false,
          defaultValue: "active",
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        deleted_at: {
          type: DataTypes.DATE,
          allowNull: true,
          defaultValue: null,
        },
      },
      {
        sequelize,
        modelName: "ProductBom",
        tableName: "prd_product_boms",
        timestamps: false,
        underscored: true,
      },
    );

    (ProductBomModel as any).initialized = true;
  }
  return ProductBomModel;
}

export default async function ProductBomModelFactory() {
  return getProductBomModel();
}
