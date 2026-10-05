import { NextRequest } from "next/server";
import { connectDatabase } from "@/database/sequelize";
import { actorFromRequest } from "@/libraries/Auth";
import { withAuthorization } from "@/libraries/AuthorizedRoute";
import { fail, getErrorStatus, ok, queryParam } from "@/libraries/Http";
import { ProductCreateUseCase } from "@/app/product/useCases/product/ProductCreateUseCase";
import { ProductListUseCase } from "@/app/product/useCases/product/ProductListUseCase";
import type { CreateProductInput } from "@/app/product/models/ProductModel";

export const runtime = "nodejs";

async function handleGet(request: NextRequest) {
  try {
    await connectDatabase();
    const params = request.nextUrl.searchParams;
    // Forward every filter[*] param so Joi (unknown(false)) rejects
    // unknown keys with 400 instead of silently ignoring them.
    const filter: Record<string, string> = {};
    params.forEach((value, key) => {
      const match = key.match(/^filter\[(.+)\]$/);
      if (match && value.trim() !== "") {
        filter[match[1]] = value;
      }
    });
    const products = await new ProductListUseCase().exec(
      {
        filter,
        sortProperty: queryParam(params, "sortProperty"),
        sortDirection: queryParam(params, "sortDirection"),
        offset: queryParam(params, "offset"),
        limit: queryParam(params, "limit"),
      },
      await actorFromRequest(request),
    );
    return ok(products);
  } catch (error: any) {
    return fail(error.message ?? "Failed to fetch products.", getErrorStatus(error, 500));
  }
}

async function handlePost(request: NextRequest) {
  try {
    await connectDatabase();
    const payload = (await request.json()) as Partial<CreateProductInput>;

    const product = await new ProductCreateUseCase().exec(payload as CreateProductInput, await actorFromRequest(request));
    return ok(product, 201);
  } catch (error: any) {
    return fail(error.message ?? "Failed to create product.", getErrorStatus(error, 500));
  }
}

export const GET = withAuthorization(handleGet, ["product:product:list:list"]);
export const POST = withAuthorization(handlePost, ["product:product:create:create"]);
