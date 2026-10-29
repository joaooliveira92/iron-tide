import { decodeStrict, type ContentSchema } from "@bluewave/content-schema";

export const collection = <K extends string, A>(
  key: K,
  schema: ContentSchema<A>,
  items: readonly NoInfer<A>[],
): { readonly [P in K]: readonly A[] } => {
  const document: Record<string, readonly A[]> = {
    [key]: items.map((item) => decodeStrict(schema, item)),
  };
  return document as { readonly [P in K]: readonly A[] };
};

export const list = <A>(schema: ContentSchema<A>, items: readonly NoInfer<A>[]): readonly A[] =>
  items.map((item) => decodeStrict(schema, item));

export const record = <A>(schema: ContentSchema<A>, value: NoInfer<A>): A =>
  decodeStrict(schema, value);
