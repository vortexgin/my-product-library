import { DataTypes, Model } from "sequelize";
import { getSequelizeInstance } from "@/database/sequelize";

export type ProductVariantStatus = "active" | "inactive" | "deleted";

export type ProductVariant = {
  uuid: string;
  product_id: string;
  organization_id: string | null;
  sku: string;
  name: string;
  price_override: number | null;
  status: ProductVariantStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreateProductVariantInput = {
  product_id: string;
  sku: string;
  name: string;
  price_override?: number | null;
  status?: ProductVariantStatus;
};

export type UpdateProductVariantInput = Partial<CreateProductVariantInput>;

/** Effective price = override ?? product base price. Never stored, always computed. */
export function resolveEffectivePrice(
  variant: Pick<ProductVariant, "price_override">,
  basePrice: number,
): number {
  return typeof variant.price_override === "number" ? variant.price_override : basePrice;
}

export type ProductVariantModelAttributes = Partial<Omit<ProductVariant, "created_at" | "updated_at" | "deleted_at">> & {
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type ProductVariantModelCreationAttributes = Partial<ProductVariantModelAttributes>;

export class ProductVariantModel extends Model<ProductVariantModelAttributes, ProductVariantModelCreationAttributes> {
  declare uuid: string;
  declare product_id: string;
  declare organization_id: string | null;
  declare sku: string;
  declare name: string;
  declare price_override: number | null;
  declare status: ProductVariantStatus;
  declare created_at: Date;
  declare updated_at: Date;
  declare deleted_at: Date | null;

  static toApi(variant: any): ProductVariant {
    return {
      uuid: variant.uuid,
      product_id: variant.product_id,
      organization_id: variant.organization_id ?? null,
      sku: variant.sku,
      name: variant.name,
      price_override: typeof variant.price_override === "number" ? variant.price_override : null,
      status: variant.status,
      created_at: variant.created_at ? new Date(variant.created_at).toISOString() : new Date().toISOString(),
      updated_at: variant.updated_at ? new Date(variant.updated_at).toISOString() : new Date().toISOString(),
      deleted_at: variant.deleted_at ? new Date(variant.deleted_at).toISOString() : null,
    };
  }
}

let productVariantModelPromise: Promise<typeof ProductVariantModel> | null = null;

export async function getProductVariantModel(): Promise<typeof ProductVariantModel> {
  if ((ProductVariantModel as any).initialized) {
    return ProductVariantModel;
  }
  if (!productVariantModelPromise) {
    productVariantModelPromise = initProductVariantModel().catch((error) => {
      productVariantModelPromise = null;
      throw error;
    });
  }
  return productVariantModelPromise;
}

async function initProductVariantModel(): Promise<typeof ProductVariantModel> {
  const sequelize = await getSequelizeInstance();

  {
    ProductVariantModel.init(
      {
        uuid: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        product_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        organization_id: {
          type: DataTypes.UUID,
          allowNull: true,
          defaultValue: null,
        },
        sku: {
          type: DataTypes.STRING(60),
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING(160),
          allowNull: false,
        },
        price_override: {
          type: DataTypes.INTEGER,
          allowNull: true,
          defaultValue: null,
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
        modelName: "ProductVariant",
        tableName: "prd_product_variants",
        timestamps: false,
        underscored: true,
      },
    );

    (ProductVariantModel as any).initialized = true;
  }
  return ProductVariantModel;
}

export default async function ProductVariantModelFactory() {
  return getProductVariantModel();
}
