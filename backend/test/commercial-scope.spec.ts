import { commercialScopeBlocks } from "../src/common/commercial-scope";

describe("commercialScopeBlocks", () => {
  const v1 = { COMMERCIAL_SCOPE: "v1" } as NodeJS.ProcessEnv;

  it("leaves routes open when commercial scope is unset", () => {
    expect(commercialScopeBlocks("/pos/sales", {})).toBeNull();
  });

  it("closes optional products under v1", () => {
    expect(commercialScopeBlocks("/api/pos/sales", v1)).toBe("FEATURE_POS");
    expect(commercialScopeBlocks("/resto/orders", v1)).toBe("FEATURE_RESTO");
    expect(commercialScopeBlocks("/public/resto/menu", v1)).toBe("FEATURE_RESTO");
    expect(commercialScopeBlocks("/payroll/runs", v1)).toBe("FEATURE_PAYROLL");
    expect(commercialScopeBlocks("/assets", v1)).toBe("FEATURE_ASSETS");
    expect(commercialScopeBlocks("/fx-revaluation", v1)).toBe("FEATURE_FX");
    expect(commercialScopeBlocks("/integrations/bhd-r/events", v1)).toBe(
      "FEATURE_BHD_R",
    );
    expect(commercialScopeBlocks("/ai/ask", v1)).toBe("FEATURE_AI");
  });

  it("keeps the accounting core open and honors an explicit flag", () => {
    expect(commercialScopeBlocks("/invoices", v1)).toBeNull();
    expect(commercialScopeBlocks("/reports/profit-loss", v1)).toBeNull();
    expect(
      commercialScopeBlocks("/pos/sales", { ...v1, FEATURE_POS: "1" }),
    ).toBeNull();
  });
});
