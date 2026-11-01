import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("login page hands off to BHD identity", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/api\/auth\/bhd\/start|id\.bhd-om\.com\//, {
      timeout: 30_000,
    });
  });

  test("register page hands off to BHD identity", async ({ page }) => {
    await page.goto("/register", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/id\.bhd-om\.com\/login/, { timeout: 30_000 });
  });

  test("complete-profile without invite shows recovery hint", async ({ page }) => {
    await page.goto("/complete-profile", { waitUntil: "domcontentloaded" });
    await expect(
      page
        .getByText(
          /invitation unavailable|الدعوة غير متاحة|ask your company|اطلب من مدير|invalid|expired|دعوة/i,
        )
        .first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("mobile app switcher", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page, baseURL }) => {
    const company = {
      id: "company-mobile-test",
      name: "Mobile Test Company",
      plan: "ENTERPRISE",
      currency: "OMR",
      country: "OM",
    };
    const user = {
      id: "user-mobile-test",
      name: "Mobile Admin",
      email: "mobile@example.com",
      role: "ADMIN",
      companyId: company.id,
      company,
      modulePermissions: {},
    };

    await page.context().addCookies([
      {
        name: "bhd_access",
        value: "smoke",
        url: baseURL || "http://127.0.0.1:3000",
      },
    ]);

    await page.addInitScript(
      ({ storedUser, storedCompany }) => {
        window.localStorage.setItem(
          "bhd-auth",
          JSON.stringify({
            state: {
              user: storedUser,
              company: storedCompany,
              isAuthenticated: true,
            },
            version: 0,
          }),
        );
      },
      { storedUser: user, storedCompany: company },
    );

    await page.route("**/backend-api/**", async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      let body: unknown = {};
      if (pathname.endsWith("/auth/me")) body = user;
      else if (pathname.endsWith("/subscriptions/current")) {
        body = {
          plan: "ENTERPRISE",
          features: { pos: true, resto: true },
          modules: {},
        };
      } else if (pathname.includes("/dashboard/stats")) {
        body = {
          totalSales: 0,
          totalPurchases: 0,
          totalExpenses: 0,
          netProfit: 0,
          salesCount: 0,
          purchasesCount: 0,
          cashFlow: [],
          recentInvoices: [],
        };
      } else if (
        pathname.includes("/orders") ||
        pathname.includes("/products") ||
        pathname.includes("/tables") ||
        pathname.includes("/zones")
      ) {
        body = [];
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
  });

  for (const [path, currentHref] of [
    ["/dashboard", "/dashboard"],
    ["/pos", "/pos"],
    ["/resto", "/resto"],
  ] as const) {
    test(`shows all app controls on ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const switcher = page.getByRole("navigation", {
        name: /Switch Hisaby app|التنقل بين أنظمة حسابي/i,
      });
      await expect(switcher).toBeVisible({ timeout: 30_000 });
      await expect(switcher.locator('a[href="/dashboard"]')).toBeVisible();
      await expect(switcher.locator('a[href="/pos"]')).toBeVisible();
      await expect(switcher.locator('a[href="/resto"]')).toBeVisible();
      await expect(
        switcher.locator(`a[href="${currentHref}"]`),
      ).toHaveAttribute("aria-current", "page");
    });
  }

  for (const [path, drawerName, closeName, sectionHref] of [
    [
      "/pos",
      /POS navigation|قائمة الكاشير/i,
      /Close POS navigation|إغلاق قائمة الكاشير/i,
      "/pos/inventory",
    ],
    [
      "/resto",
      /Restaurant navigation|قائمة المطعم/i,
      /Close restaurant navigation|إغلاق قائمة المطعم/i,
      "/resto/takeaway",
    ],
  ] as const) {
    test(`opens the full-screen navigation drawer on ${path}`, async ({
      page,
    }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const menuButton = page.getByRole("button", { name: "Menu" });
      await expect(menuButton).toBeVisible({ timeout: 30_000 });
      await menuButton.click();

      const drawer = page.getByRole("dialog", { name: drawerName });
      await expect(drawer).toBeVisible();
      await expect(
        drawer.locator(`a[href="${sectionHref}"]`).first(),
      ).toBeVisible();

      const box = await drawer.boundingBox();
      expect(box?.height).toBeGreaterThan(800);

      await drawer.getByRole("button", { name: closeName }).click();
      await expect(drawer).toBeHidden();

      await menuButton.click();
      await drawer.locator(`a[href="${sectionHref}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${sectionHref}$`));
    });
  }
});
