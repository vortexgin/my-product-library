import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok, queryParam } from "@/libraries/Http";
import { ProductVariantCreateUseCase } from "@/app/product/useCases/productVariant/ProductVariantCreateUseCase";
import { ProductVariantListUseCase } from "@/app/product/useCases/productVariant/ProductVariantListUseCase";
import type { CreateProductVariantInput } from "@/app/product/models/ProductVariantModel";

export const runtime = "nodejs";

async function handleGet(request: NextRequest) {
  try {
    await connectDatabase();
    const params = request.nextUrl.searchParams;
    const rows = await new ProductVariantListUseCase().exec(
      {
        filter: {
          q: queryParam(params, "filter[q]"),
          product_id: queryParam(params, "filter[product_id]"),
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
    return fail(error.message ?? "Failed to fetch product variants.", getErrorStatus(error, 500));
  }
}

async function handlePost(request: NextRequest) {
  try {
    await connectDatabase();
    const payload = (await request.json()) as Partial<CreateProductVariantInput>;

    const row = await new ProductVariantCreateUseCase().exec(payload as CreateProductVariantInput, await actorFromRequest(request));
    return ok(row, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create product variant.", getErrorStatus(error, 500));
  }
}

export const GET = withAuthorization(handleGet, ["product:variant:list:list"]);
export const POST = withAuthorization(handlePost, ["product:variant:create:create"]);
