import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_SCRIPTED_ORDERS_TEXT, parseScriptedOrders } from "./scripted-orders.js";

describe("scripted-orders", () => {
  it("defaults to a parseable sample order", () => {
    expect(parseScriptedOrders(DEFAULT_SCRIPTED_ORDERS_TEXT).ok).toBe(true);
  });

  it("parses valid scripted orders JSON", () => {
    const result = parseScriptedOrders(
      '[{"issueTurn":1,"divisionId":"Channel Squadron","orderType":"disengage"}]',
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.orders).toHaveLength(1);
  });

  it("rejects malformed JSON", () => {
    const result = parseScriptedOrders("not json");
    expect(result.ok).toBe(false);
  });

  it("rejects a JSON value that is not an array", () => {
    const result = parseScriptedOrders('{"issueTurn":1}');
    expect(result.ok).toBe(false);
  });

  it("rejects an order missing required fields", () => {
    const result = parseScriptedOrders('[{"issueTurn":1}]');
    expect(result.ok).toBe(false);
  });
});
