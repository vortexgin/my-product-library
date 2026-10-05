import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok } from "@/libraries/Http";
import { ProductMetadataFieldDeleteUseCase } from "@/app/product/useCases/productMetadataField/ProductMetadataFieldDeleteUseCase";
import { ProductMetadataFieldGetUseCase } from "@/app/product/useCases/productMetadataField/ProductMetadataFieldGetUseCase";
import { ProductMetadataFieldUpdateUseCase } from "@/app/product/useCases/productMetadataField/ProductMetadataFieldUpdateUseCase";
import type { UpdateProductMetadataFieldInput } from "@/app/product/models/ProductMetadataFieldModel";

export const runtime = "nodejs";

async function handleGet(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const row = await new ProductMetadataFieldGetUseCase().exec(uuid);

    return ok(row);
  } catch (error: any) {
    return fail(error.message ?? "Failed to fetch product metadata field.", getErrorStatus(error, 500));
  }
}

async function handlePut(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const payload = (await request.json()) as UpdateProductMetadataFieldInput;

    const row = await new ProductMetadataFieldUpdateUseCase().exec(uuid, payload, await actorFromRequest(request));
    return ok(row);
  } catch (error: any) {
    return fail(error.message ?? "Failed to update product metadata field.", getErrorStatus(error, 400));
  }
}

async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    await new ProductMetadataFieldDeleteUseCase().exec(uuid, await actorFromRequest(request));

    return ok({ message: "Product metadata field deleted successfully." });
  } catch (error: any) {
    return fail(error.message ?? "Failed to delete product metadata field.", getErrorStatus(error, 400));
  }
}

export const GET = withAuthorization(handleGet, ["product:metadata-field:view:detail"]);
export const PUT = withAuthorization(handlePut, ["authorized", "product:metadata-field:view:update"]);
export const DELETE = withAuthorization(handleDelete, ["product:metadata-field:view:delete"]);
