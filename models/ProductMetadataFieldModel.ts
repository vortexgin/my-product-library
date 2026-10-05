import { DataTypes, Model } from "sequelize";
import { getSequelizeInstance } from "@/database/sequelize";

export type ProductMetadataFieldState = "active" | "inactive" | "deleted";

export type ProductMetadataField = {
  uuid: string;
  organization_id: string | null;
  name: string;
  description: string;
  status: ProductMetadataFieldState;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreateProductMetadataFieldInput = {
  name: string;
  description: string;
  status?: ProductMetadataFieldState;
};

export type UpdateProductMetadataFieldInput = Partial<CreateProductMetadataFieldInput>;

export type ProductMetadataFieldModelAttributes = Partial<Omit<ProductMetadataField, "created_at" | "updated_at" | "deleted_at">> & {
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type ProductMetadataFieldModelCreationAttributes = Partial<ProductMetadataFieldModelAttributes>;

export class ProductMetadataFieldModel extends Model<ProductMetadataFieldModelAttributes, ProductMetadataFieldModelCreationAttributes> {
  declare uuid: string;
  declare organization_id: string | null;
  declare name: string;
  declare description: string;
  declare status: ProductMetadataFieldState;
  declare created_at: Date;
  declare updated_at: Date;
  declare deleted_at: Date | null;

  static toApi(field: any): ProductMetadataField {
    return {
      uuid: field.uuid,
      organization_id: field.organization_id ?? null,
      name: field.name,
      description: field.description,
      status: field.status,
      created_at: field.created_at ? new Date(field.created_at).toISOString() : new Date().toISOString(),
      updated_at: field.updated_at ? new Date(field.updated_at).toISOString() : new Date().toISOString(),
      deleted_at: field.deleted_at ? new Date(field.deleted_at).toISOString() : null,
    };
  }
}

let productMetadataFieldModelPromise: Promise<typeof ProductMetadataFieldModel> | null = null;

export async function getProductMetadataFieldModel(): Promise<typeof ProductMetadataFieldModel> {
  if ((ProductMetadataFieldModel as any).initialized) {
    return ProductMetadataFieldModel;
  }
  if (!productMetadataFieldModelPromise) {
    productMetadataFieldModelPromise = initProductMetadataFieldModel().catch((error) => {
      productMetadataFieldModelPromise = null;
      throw error;
    });
  }
  return productMetadataFieldModelPromise;
}

async function initProductMetadataFieldModel(): Promise<typeof ProductMetadataFieldModel> {
  const sequelize = await getSequelizeInstance();

  {
    ProductMetadataFieldModel.init(
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
        modelName: "ProductMetadataField",
        tableName: "prd_product_metadata_fields",
        timestamps: false,
        underscored: true,
      },
    );

    (ProductMetadataFieldModel as any).initialized = true;
  }
  return ProductMetadataFieldModel;
}

export default async function ProductMetadataFieldModelFactory() {
  return getProductMetadataFieldModel();
}
