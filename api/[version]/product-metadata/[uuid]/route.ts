import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok } from "@/libraries/Http";
import { ProductMetadataDeleteUseCase } from "@/app/product/useCases/productMetadata/ProductMetadataDeleteUseCase";
import { ProductMetadataGetUseCase } from "@/app/product/useCases/productMetadata/ProductMetadataGetUseCase";
import { ProductMetadataUpdateUseCase } from "@/app/product/useCases/productMetadata/ProductMetadataUpdateUseCase";
import type { UpdateProductMetadataInput } from "@/app/product/models/ProductMetadataModel";

export const runtime = "nodejs";

async function handleGet(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const row = await new ProductMetadataGetUseCase().exec(uuid);

    return ok(row);
  } catch (error: any) {
    return fail(error.message ?? "Failed to fetch product metadata.", getErrorStatus(error, 500));
  }
}

async function handlePut(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    const payload = (await request.json()) as UpdateProductMetadataInput;

    const row = await new ProductMetadataUpdateUseCase().exec(uuid, payload, await actorFromRequest(request));
    return ok(row);
  } catch (error: any) {
    return fail(error.message ?? "Failed to update product metadata.", getErrorStatus(error, 400));
  }
}

async function handleDelete(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  try {
    await connectDatabase();
    const { uuid } = await params;
    await new ProductMetadataDeleteUseCase().exec(uuid, await actorFromRequest(request));

    return ok({ message: "Product metadata deleted successfully." });
  } catch (error: any) {
    return fail(error.message ?? "Failed to delete product metadata.", getErrorStatus(error, 400));
  }
}

export const GET = withAuthorization(handleGet, ["product:metadata:view:detail"]);
export const PUT = withAuthorization(handlePut, ["authorized", "product:metadata:view:update"]);
export const DELETE = withAuthorization(handleDelete, ["product:metadata:view:delete"]);
