import { DataTypes, Model } from "sequelize";
import { getSequelizeInstance } from "@/database/sequelize";

export type ProductCategoryStatus = "active" | "inactive" | "deleted";

export type ProductCategory = {
  uuid: string;
  organization_id: string | null;
  name: string;
  description: string;
  status: ProductCategoryStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreateProductCategoryInput = {
  name: string;
  description: string;
  status?: ProductCategoryStatus;
};

export type UpdateProductCategoryInput = Partial<CreateProductCategoryInput>;

export type ProductCategoryModelAttributes = Partial<Omit<ProductCategory, "created_at" | "updated_at" | "deleted_at">> & {
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type ProductCategoryModelCreationAttributes = Partial<ProductCategoryModelAttributes>;

export class ProductCategoryModel extends Model<ProductCategoryModelAttributes, ProductCategoryModelCreationAttributes> {
  declare uuid: string;
  declare organization_id: string | null;
  declare name: string;
  declare description: string;
  declare status: ProductCategoryStatus;
  declare created_at: Date;
  declare updated_at: Date;
  declare deleted_at: Date | null;

  static toApi(category: any): ProductCategory {
    return {
      uuid: category.uuid,
      organization_id: category.organization_id ?? null,
      name: category.name,
      description: category.description,
      status: category.status,
      created_at: category.created_at ? new Date(category.created_at).toISOString() : new Date().toISOString(),
      updated_at: category.updated_at ? new Date(category.updated_at).toISOString() : new Date().toISOString(),
      deleted_at: category.deleted_at ? new Date(category.deleted_at).toISOString() : null,
    };
  }
}

let productCategoryModelPromise: Promise<typeof ProductCategoryModel> | null = null;

export async function getProductCategoryModel(): Promise<typeof ProductCategoryModel> {
  if ((ProductCategoryModel as any).initialized) {
    return ProductCategoryModel;
  }
  if (!productCategoryModelPromise) {
    productCategoryModelPromise = initProductCategoryModel().catch((error) => {
      productCategoryModelPromise = null;
      throw error;
    });
  }
  return productCategoryModelPromise;
}

async function initProductCategoryModel(): Promise<typeof ProductCategoryModel> {
  const sequelize = await getSequelizeInstance();

  {
    ProductCategoryModel.init(
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
        name: {
          type: DataTypes.STRING(160),
          allowNull: false,
        },
        description: {
          type: DataTypes.TEXT,
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
        modelName: "ProductCategory",
        tableName: "prd_categories",
        timestamps: false,
        underscored: true,
      },
    );

    (ProductCategoryModel as any).initialized = true;
  }
  return ProductCategoryModel;
}

export default async function ProductCategoryModelFactory() {
  return getProductCategoryModel();
}
