import { DataTypes, Model } from "sequelize";
import { getSequelizeInstance } from "@/database/sequelize";

export type ProductMetadataStatus = "active" | "inactive" | "deleted";

export type ProductMetadata = {
  uuid: string;
  product_id: string;
  variant_id: string | null;
  product_metadata_field_id: string;
  value: string;
  status: ProductMetadataStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreateProductMetadataInput = {
  product_id: string;
  variant_id?: string | null;
  product_metadata_field_id: string;
  value: string;
  status?: ProductMetadataStatus;
};

export type UpdateProductMetadataInput = Partial<CreateProductMetadataInput>;

export type ProductMetadataModelAttributes = Partial<Omit<ProductMetadata, "created_at" | "updated_at" | "deleted_at">> & {
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type ProductMetadataModelCreationAttributes = Partial<ProductMetadataModelAttributes>;

export class ProductMetadataModel extends Model<ProductMetadataModelAttributes, ProductMetadataModelCreationAttributes> {
  declare uuid: string;
  declare product_id: string;
  declare variant_id: string | null;
  declare product_metadata_field_id: string;
  declare value: string;
  declare status: ProductMetadataStatus;
  declare created_at: Date;
  declare updated_at: Date;
  declare deleted_at: Date | null;

  static toApi(row: any): ProductMetadata {
    return {
      uuid: row.uuid,
      product_id: row.product_id,
      variant_id: row.variant_id ?? null,
      product_metadata_field_id: row.product_metadata_field_id,
      value: row.value,
      status: row.status,
      created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    };
  }
}

let productMetadataModelPromise: Promise<typeof ProductMetadataModel> | null = null;

export async function getProductMetadataModel(): Promise<typeof ProductMetadataModel> {
  if ((ProductMetadataModel as any).initialized) {
    return ProductMetadataModel;
  }
  if (!productMetadataModelPromise) {
    productMetadataModelPromise = initProductMetadataModel().catch((error) => {
      productMetadataModelPromise = null;
      throw error;
    });
  }
  return productMetadataModelPromise;
}

async function initProductMetadataModel(): Promise<typeof ProductMetadataModel> {
  const sequelize = await getSequelizeInstance();

  {
    ProductMetadataModel.init(
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
        variant_id: {
          type: DataTypes.UUID,
          allowNull: true,
          defaultValue: null,
        },
        product_metadata_field_id: {
          type: DataTypes.UUID,
          allowNull: false,
        },
        value: {
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
        modelName: "ProductMetadata",
        tableName: "prd_product_metadata",
        timestamps: false,
        underscored: true,
      },
    );

    (ProductMetadataModel as any).initialized = true;
  }
  return ProductMetadataModel;
}

export default async function ProductMetadataModelFactory() {
  return getProductMetadataModel();
}
