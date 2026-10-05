import { DataTypes, Model } from "sequelize";
import { getSequelizeInstance } from "@/database/sequelize";

export type ProductUnitStatus = "active" | "inactive" | "deleted";

export type ProductUnit = {
  uuid: string;
  organization_id: string | null;
  name: string;
  symbol: string;
  status: ProductUnitStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CreateProductUnitInput = {
  name: string;
  symbol: string;
  status?: ProductUnitStatus;
};

export type UpdateProductUnitInput = Partial<CreateProductUnitInput>;

export type ProductUnitModelAttributes = Partial<Omit<ProductUnit, "created_at" | "updated_at" | "deleted_at">> & {
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type ProductUnitModelCreationAttributes = Partial<ProductUnitModelAttributes>;

export class ProductUnitModel extends Model<ProductUnitModelAttributes, ProductUnitModelCreationAttributes> {
  declare uuid: string;
  declare organization_id: string | null;
  declare name: string;
  declare symbol: string;
  declare status: ProductUnitStatus;
  declare created_at: Date;
  declare updated_at: Date;
  declare deleted_at: Date | null;

  static toApi(unit: any): ProductUnit {
    return {
      uuid: unit.uuid,
      organization_id: unit.organization_id ?? null,
      name: unit.name,
      symbol: unit.symbol,
      status: unit.status,
      created_at: unit.created_at ? new Date(unit.created_at).toISOString() : new Date().toISOString(),
      updated_at: unit.updated_at ? new Date(unit.updated_at).toISOString() : new Date().toISOString(),
      deleted_at: unit.deleted_at ? new Date(unit.deleted_at).toISOString() : null,
    };
  }
}

let productUnitModelPromise: Promise<typeof ProductUnitModel> | null = null;

export async function getProductUnitModel(): Promise<typeof ProductUnitModel> {
  if ((ProductUnitModel as any).initialized) {
    return ProductUnitModel;
  }
  if (!productUnitModelPromise) {
    productUnitModelPromise = initProductUnitModel().catch((error) => {
      productUnitModelPromise = null;
      throw error;
    });
  }
  return productUnitModelPromise;
}

async function initProductUnitModel(): Promise<typeof ProductUnitModel> {
  const sequelize = await getSequelizeInstance();

  {
    ProductUnitModel.init(
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
          type: DataTypes.STRING(60),
          allowNull: false,
        },
        symbol: {
          type: DataTypes.STRING(10),
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
        modelName: "ProductUnit",
        tableName: "prd_units",
        timestamps: false,
        underscored: true,
      },
    );

    (ProductUnitModel as any).initialized = true;
  }
  return ProductUnitModel;
}

export default async function ProductUnitModelFactory() {
  return getProductUnitModel();
}
