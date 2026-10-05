import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok } from "@/libraries/Http";
import { ProductCategoryDeleteUseCase } from "@/app/product/useCases/productCategory/ProductCategoryDeleteUseCase";
import { ProductCategoryGetUseCase } from "@/app/product/useCases/productCategory/ProductCategoryGetUseCase";
import { ProductCategoryUpdateUseCase } from "@/app/product/useCases/productCategory/ProductCategoryUpdateUseCase";
import type { UpdateProductCategoryInput } from "@/app/product/models/ProductCategoryModel";

export const runtime = "nodejs";

async function handleGet(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const row = await new ProductCategoryGetUseCase().exec(uuid);

    return ok(row);
  } catch (error: any) {
    return fail(error.message ?? "Failed to fetch product category.", getErrorStatus(error, 500));
  }
}

async function handlePut(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const payload = (await request.json()) as UpdateProductCategoryInput;

    const row = await new ProductCategoryUpdateUseCase().exec(uuid, payload, await actorFromRequest(request));
    return ok(row);
  } catch (error: any) {
    return fail(error.message ?? "Failed to update product category.", getErrorStatus(error, 400));
  }
}

async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    await new ProductCategoryDeleteUseCase().exec(uuid, await actorFromRequest(request));

    return ok({ message: "Product category deleted successfully." });
  } catch (error: any) {
    return fail(error.message ?? "Failed to delete product category.", getErrorStatus(error, 400));
  }
}

export const GET = withAuthorization(handleGet, ["product:category:view:detail"]);
export const PUT = withAuthorization(handlePut, ["authorized", "product:category:view:update"]);
export const DELETE = withAuthorization(handleDelete, ["product:category:view:delete"]);
