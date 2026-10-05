import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok } from "@/libraries/Http";
import { ProductDeleteUseCase } from "@/app/product/useCases/product/ProductDeleteUseCase";
import { ProductGetUseCase } from "@/app/product/useCases/product/ProductGetUseCase";
import { ProductUpdateUseCase } from "@/app/product/useCases/product/ProductUpdateUseCase";
import type { UpdateProductInput } from "@/app/product/models/ProductModel";

export const runtime = "nodejs";

async function handleGet(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const product = await new ProductGetUseCase().exec(uuid);

    return ok(product);
  } catch (error: any) {
    return fail(error.message ?? "Failed to fetch product.", getErrorStatus(error, 500));
  }
}

async function handlePut(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const payload = (await request.json()) as UpdateProductInput;

    const product = await new ProductUpdateUseCase().exec(uuid, payload, await actorFromRequest(request));
    return ok(product);
  } catch (error: any) {
    return fail(error.message ?? "Failed to update product.", getErrorStatus(error, 400));
  }
}

async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    await new ProductDeleteUseCase().exec(uuid, await actorFromRequest(request));

    return ok({ message: "Product deleted successfully." });
  } catch (error: any) {
    return fail(error.message ?? "Failed to delete product.", getErrorStatus(error, 400));
  }
}

export const GET = withAuthorization(handleGet, ["product:product:view:detail"]);
export const PUT = withAuthorization(handlePut, ["authorized", "product:product:view:update"]);
export const DELETE = withAuthorization(handleDelete, ["product:product:view:delete"]);
