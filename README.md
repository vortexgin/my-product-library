# my-product-library

**Module:** `product` (git submodule `vortexgin/my-product-library`)
**Entities:** `product` · `product-variant` · `product-category` · `product-unit` · `product-metadata` · `product-metadata-field`

## Purpose

Sellable master data for Warehouse (stock/movements) and Marketing (campaigns/promos).
Product owns `sku` (required, unique per org) + `base_price` (required); Warehouse/Marketing only reference `product_id`/`variant_id`.

## Entities

| Entity | Table | Collection route | Activity entity |
|---|---|---|---|
| product | `prd_products` | `/product/api/v1/products` | `product` |
| product-variant | `prd_product_variants` | `/product/api/v1/product-variants` | `product_variant` |
| product-category | `prd_categories` | `/product/api/v1/product-categories` | `product_category` |
| product-unit | `prd_units` | `/product/api/v1/product-units` | `product_unit` |
| product-metadata | `prd_product_metadata` | `/product/api/v1/product-metadata` | `product_metadata` |
| product-metadata-field | `prd_product_metadata_fields` | `/product/api/v1/product-metadata-fields` | `product_metadata_field` |

## Conventions

Same vertical slice as sales/sass: `models/` → `useCases/` (`BaseUseCase`, Joi in `preExec`) → `api/[version]/` (`runtime="nodejs"`, `withAuthorization`, `ok()`/`fail()`) → `components/` + `views/` + `paths.ts`. Soft delete, org-scoped, encrypted JSON-only transport.
