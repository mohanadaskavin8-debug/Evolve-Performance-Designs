// Export only Zod validators (not the types barrel) to avoid duplicate-export
// collisions when Orval generates the same name in both generated/api.ts and
// generated/types/*.ts (e.g. *Params schemas for path-parameter operations).
export * from "./generated/api";
export * from './generated/types';

// Orval generates `RemoveCartItemParams` twice for the delete-cart-item
// operation: a Zod schema for the path params (generated/api) and a TS type
// for the query params (generated/types). Explicitly re-export the Zod schema
// to resolve the export-* ambiguity (TS2308).
export { RemoveCartItemParams } from "./generated/api";
