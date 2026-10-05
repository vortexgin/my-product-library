import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok } from "@/libraries/Http";
import { ProductVariantDeleteUseCase } from "@/app/product/useCases/productVariant/ProductVariantDeleteUseCase";
import { ProductVariantGetUseCase } from "@/app/product/useCases/productVariant/ProductVariantGetUseCase";
import { ProductVariantUpdateUseCase } from "@/app/product/useCases/productVariant/ProductVariantUpdateUseCase";
import type { UpdateProductVariantInput } from "@/app/product/models/ProductVariantModel";

export const runtime = "nodejs";

async function handleGet(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const row = await new ProductVariantGetUseCase().exec(uuid);

    return ok(row);
  } catch (error: any) {
    return fail(error.message ?? "Failed to fetch product variant.", getErrorStatus(error, 500));
  }
}

async function handlePut(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const payload = (await request.json()) as UpdateProductVariantInput;

    const row = await new ProductVariantUpdateUseCase().exec(uuid, payload, await actorFromRequest(request));
    return ok(row);
  } catch (error: any) {
    return fail(error.message ?? "Failed to update product variant.", getErrorStatus(error, 400));
  }
}

async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    await new ProductVariantDeleteUseCase().exec(uuid, await actorFromRequest(request));

    return ok({ message: "Product variant deleted successfully." });
  } catch (error: any) {
    return fail(error.message ?? "Failed to delete product variant.", getErrorStatus(error, 400));
  }
}

export const GET = withAuthorization(handleGet, ["product:variant:view:detail"]);
export const PUT = withAuthorization(handlePut, ["authorized", "product:variant:view:update"]);
export const DELETE = withAuthorization(handleDelete, ["product:variant:view:delete"]);
