import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok, queryParam } from "@/libraries/Http";
import { ProductCategoryCreateUseCase } from "@/app/product/useCases/productCategory/ProductCategoryCreateUseCase";
import { ProductCategoryListUseCase } from "@/app/product/useCases/productCategory/ProductCategoryListUseCase";
import type { CreateProductCategoryInput } from "@/app/product/models/ProductCategoryModel";

export const runtime = "nodejs";

async function handleGet(request: NextRequest) {
  try {
    await connectDatabase();
    const params = request.nextUrl.searchParams;
    const rows = await new ProductCategoryListUseCase().exec(
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
    return fail(error.message ?? "Failed to fetch product categories.", getErrorStatus(error, 500));
  }
}

async function handlePost(request: NextRequest) {
  try {
    await connectDatabase();
    const payload = (await request.json()) as Partial<CreateProductCategoryInput>;

    const row = await new ProductCategoryCreateUseCase().exec(payload as CreateProductCategoryInput, await actorFromRequest(request));
    return ok(row, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create product category.", getErrorStatus(error, 500));
  }
}

export const GET = withAuthorization(handleGet, ["product:category:list:list"]);
export const POST = withAuthorization(handlePost, ["product:category:create:create"]);
