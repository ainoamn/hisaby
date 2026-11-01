/**
 * Commercial v1 closes optional products on the server.
 * Set COMMERCIAL_SCOPE=v1 at launch. A module stays closed unless its flag is "1".
 * Unset scope keeps the current routes so existing deployments are unchanged.
 */
export const COMMERCIAL_OPTIONAL_ROUTES: Array<{
  prefix: string;
  flag: string;
}> = [
  { prefix: "/pos", flag: "FEATURE_POS" },
  { prefix: "/resto", flag: "FEATURE_RESTO" },
  { prefix: "/public/resto", flag: "FEATURE_RESTO" },
  { prefix: "/payroll", flag: "FEATURE_PAYROLL" },
  { prefix: "/assets", flag: "FEATURE_ASSETS" },
  { prefix: "/exchange-rates", flag: "FEATURE_FX" },
  { prefix: "/fx-revaluation", flag: "FEATURE_FX" },
  { prefix: "/integrations/bhd-r", flag: "FEATURE_BHD_R" },
  { prefix: "/ai", flag: "FEATURE_AI" },
];

export function commercialScopeBlocks(
  path: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (env.COMMERCIAL_SCOPE !== "v1") return null;
  const normalized = path.startsWith("/api/")
    ? path.slice(4)
    : path.startsWith("/api")
      ? path.slice(4) || "/"
      : path;
  const match = COMMERCIAL_OPTIONAL_ROUTES.find(
    (route) =>
      normalized === route.prefix || normalized.startsWith(`${route.prefix}/`),
  );
  if (!match) return null;
  if (env[match.flag] === "1") return null;
  return match.flag;
}
