import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok, queryParam } from "@/libraries/Http";
import { ProductUnitCreateUseCase } from "@/app/product/useCases/productUnit/ProductUnitCreateUseCase";
import { ProductUnitListUseCase } from "@/app/product/useCases/productUnit/ProductUnitListUseCase";
import type { CreateProductUnitInput } from "@/app/product/models/ProductUnitModel";

export const runtime = "nodejs";

async function handleGet(request: NextRequest) {
  try {
    await connectDatabase();
    const params = request.nextUrl.searchParams;
    const rows = await new ProductUnitListUseCase().exec(
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
    return fail(error.message ?? "Failed to fetch product units.", getErrorStatus(error, 500));
  }
}

async function handlePost(request: NextRequest) {
  try {
    await connectDatabase();
    const payload = (await request.json()) as Partial<CreateProductUnitInput>;

    const row = await new ProductUnitCreateUseCase().exec(payload as CreateProductUnitInput, await actorFromRequest(request));
    return ok(row, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create product unit.", getErrorStatus(error, 500));
  }
}

export const GET = withAuthorization(handleGet, ["product:unit:list:list"]);
export const POST = withAuthorization(handlePost, ["product:unit:create:create"]);
