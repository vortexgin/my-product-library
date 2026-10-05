import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok } from "@/libraries/Http";
import { ProductUnitDeleteUseCase } from "@/app/product/useCases/productUnit/ProductUnitDeleteUseCase";
import { ProductUnitGetUseCase } from "@/app/product/useCases/productUnit/ProductUnitGetUseCase";
import { ProductUnitUpdateUseCase } from "@/app/product/useCases/productUnit/ProductUnitUpdateUseCase";
import type { UpdateProductUnitInput } from "@/app/product/models/ProductUnitModel";

export const runtime = "nodejs";

async function handleGet(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const row = await new ProductUnitGetUseCase().exec(uuid);

    return ok(row);
  } catch (error: any) {
    return fail(error.message ?? "Failed to fetch product unit.", getErrorStatus(error, 500));
  }
}

async function handlePut(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const payload = (await request.json()) as UpdateProductUnitInput;

    const row = await new ProductUnitUpdateUseCase().exec(uuid, payload, await actorFromRequest(request));
    return ok(row);
  } catch (error: any) {
    return fail(error.message ?? "Failed to update product unit.", getErrorStatus(error, 400));
  }
}

async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    await new ProductUnitDeleteUseCase().exec(uuid, await actorFromRequest(request));

    return ok({ message: "Product unit deleted successfully." });
  } catch (error: any) {
    return fail(error.message ?? "Failed to delete product unit.", getErrorStatus(error, 400));
  }
}

export const GET = withAuthorization(handleGet, ["product:unit:view:detail"]);
export const PUT = withAuthorization(handlePut, ["authorized", "product:unit:view:update"]);
export const DELETE = withAuthorization(handleDelete, ["product:unit:view:delete"]);
