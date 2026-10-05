import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok, queryParam } from "@/libraries/Http";
import { ProductMetadataFieldCreateUseCase } from "@/app/product/useCases/productMetadataField/ProductMetadataFieldCreateUseCase";
import { ProductMetadataFieldListUseCase } from "@/app/product/useCases/productMetadataField/ProductMetadataFieldListUseCase";
import type { CreateProductMetadataFieldInput } from "@/app/product/models/ProductMetadataFieldModel";

export const runtime = "nodejs";

async function handleGet(request: NextRequest) {
  try {
    await connectDatabase();
    const params = request.nextUrl.searchParams;
    const rows = await new ProductMetadataFieldListUseCase().exec(
      {
        filter: {
          q: queryParam(params, "filter[q]"),
          name: queryParam(params, "filter[name]"),
          status: queryParam(params, "filter[status]"),
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
    return fail(error.message ?? "Failed to fetch product metadata fields.", getErrorStatus(error, 500));
  }
}

async function handlePost(request: NextRequest) {
  try {
    await connectDatabase();
    const payload = (await request.json()) as Partial<CreateProductMetadataFieldInput>;

    const row = await new ProductMetadataFieldCreateUseCase().exec(payload as CreateProductMetadataFieldInput, await actorFromRequest(request));
    return ok(row, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create product metadata field.", getErrorStatus(error, 500));
  }
}

export const GET = withAuthorization(handleGet, ["product:metadata-field:list:list"]);
export const POST = withAuthorization(handlePost, ["product:metadata-field:create:create"]);
