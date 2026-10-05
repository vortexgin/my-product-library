import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok, queryParam } from "@/libraries/Http";
import { ProductMetadataCreateUseCase } from "@/app/product/useCases/productMetadata/ProductMetadataCreateUseCase";
import { ProductMetadataListUseCase } from "@/app/product/useCases/productMetadata/ProductMetadataListUseCase";
import type { CreateProductMetadataInput } from "@/app/product/models/ProductMetadataModel";

export const runtime = "nodejs";

async function handleGet(request: NextRequest) {
  try {
    await connectDatabase();
    const params = request.nextUrl.searchParams;
    const rows = await new ProductMetadataListUseCase().exec(
      {
        filter: {
          product_id: queryParam(params, "filter[product_id]"),
          variant_id: queryParam(params, "filter[variant_id]"),
        },
        sortProperty: queryParam(params, "sortProperty"),
        sortDirection: queryParam(params, "sortDirection"),
        offset: queryParam(params, "offset"),
        limit: queryParam(params, "limit"),
      },
      await actorFromRequest(request),
    );
    return ok(rows);
  } catch (error: any) {
    return fail(error.message ?? "Failed to fetch product metadata.", getErrorStatus(error, 500));
  }
}

async function handlePost(request: NextRequest) {
  try {
    await connectDatabase();
    const payload = (await request.json()) as Partial<CreateProductMetadataInput>;

    const row = await new ProductMetadataCreateUseCase().exec(payload as CreateProductMetadataInput, await actorFromRequest(request));
    return ok(row, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create product metadata.", getErrorStatus(error, 500));
  }
}

export const GET = withAuthorization(handleGet, ["product:metadata:list:list"]);
export const POST = withAuthorization(handlePost, ["product:metadata:create:create"]);
