import { DataTypes, Model } from "sequelize";
import { getSequelizeInstance } from "@/database/sequelize";

export type ProductStatus = "active" | "inactive" | "deleted";

export type Product = {
  uuid: string;
  organization_id: string | null;
  sku: string;
  name: string;
  description: string | null;
  category_id: string | null;
  unit_id: string | null;
  base_price: number;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ProductMetadataNestedInput = {
  uuid?: string;
  product_metadata_field_id?: string;
  field_name?: string;
  variant_id?: string | null;
  value: string;
};

export type CreateProductInput = {
  sku: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  unit_id?: string | null;
  base_price: number;
  status?: ProductStatus;
  metadata?: ProductMetadataNestedInput[];
};

export type UpdateProductInput = Partial<CreateProductInput>;

export type ProductModelAttributes = Partial<Omit<Product, "created_at" | "updated_at" | "deleted_at">> & {
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type ProductModelCreationAttributes = Partial<ProductModelAttributes>;

export class ProductModel extends Model<ProductModelAttributes, ProductModelCreationAttributes> {
  declare uuid: string;
  declare organization_id: string | null;
  declare sku: string;
  declare name: string;
  declare description: string | null;
  declare category_id: string | null;
  declare unit_id: string | null;
  declare base_price: number;
  declare status: ProductStatus;
  declare created_at: Date;
  declare updated_at: Date;
  declare deleted_at: Date | null;

  static toApi(product: any): Product {
    return {
      uuid: product.uuid,
      organization_id: product.organization_id ?? null,
      sku: product.sku,
      name: product.name,
      description: product.description ?? null,
      category_id: product.category_id ?? null,
      unit_id: product.unit_id ?? null,
      base_price: typeof product.base_price === "number" ? product.base_price : 0,
      status: product.status,
      created_at: product.created_at ? new Date(product.created_at).toISOString() : new Date().toISOString(),
      updated_at: product.updated_at ? new Date(product.updated_at).toISOString() : new Date().toISOString(),
      deleted_at: product.deleted_at ? new Date(product.deleted_at).toISOString() : null,
    };
  }
}

let productModelPromise: Promise<typeof ProductModel> | null = null;

export async function getProductModel(): Promise<typeof ProductModel> {
  if ((ProductModel as any).initialized) {
    return ProductModel;
  }
  if (!productModelPromise) {
    productModelPromise = initProductModel().catch((error) => {
      productModelPromise = null;
      throw error;
    });
  }
  return productModelPromise;
}

async function initProductModel(): Promise<typeof ProductModel> {
  const sequelize = await getSequelizeInstance();

  {
    ProductModel.init(
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
        sku: {
          type: DataTypes.STRING(60),
          allowNull: false,
        },
        name: {
          type: DataTypes.STRING(160),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
          defaultValue: null,
        },
        category_id: {
          type: DataTypes.UUID,
          allowNull: true,
          defaultValue: null,
        },
        unit_id: {
          type: DataTypes.UUID,
          allowNull: true,
          defaultValue: null,
        },
        base_price: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
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
        modelName: "Product",
        tableName: "prd_products",
        timestamps: false,
        underscored: true,
      },
    );

    (ProductModel as any).initialized = true;
  }
  return ProductModel;
}

export default async function ProductModelFactory() {
  return getProductModel();
}
