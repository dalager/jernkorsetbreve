import { test, expect } from "@playwright/test";

test.describe("Static Site - Home Page (Landing)", () => {
  test("should load the home page with site title", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The landing page shows the project name
    await expect(page.getByRole("heading", { name: "Jernkorset" })).toBeVisible();
  });

  test("should display introduction and section links", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Landing page mentions Peter Mærsk and the collection
    const content = await page.content();
    expect(content).toContain("Peter");
    expect(content).toContain("1911");

    // Should have a prominent link to the letter list
    const breveLink = page.getByRole("link", { name: /Læs brevene/i });
    await expect(breveLink).toBeVisible();
  });

  test("should navigate to letter list via featured link", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const breveLink = page.getByRole("link", { name: /Læs brevene/i });
    await breveLink.click();

    await expect(page).toHaveURL("/breve/");
  });
});

test.describe("Static Site - Letter List (/breve)", () => {
  test("should display letter links on the letter list page", async ({ page }) => {
    await page.goto("/breve/");
    await page.waitForLoadState("networkidle");

    // Letter links to /letters/<id>/ should be present
    const letterLinks = page.locator('a[href*="/letters/"]');
    const count = await letterLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should navigate to letter detail when clicking a letter link", async ({
    page,
  }) => {
    await page.goto("/breve/");
    await page.waitForLoadState("networkidle");

    // Click the first letter link
    const firstCard = page.locator('a[href*="/letters/"]').first();
    await firstCard.click();

    // Should navigate to a letter detail page
    await expect(page).toHaveURL(/\/letters\/\d+\//);
  });
});

test.describe("Static Site - Letter Detail Page", () => {
  test("should display letter with sender and recipient labels", async ({
    page,
  }) => {
    await page.goto("/letters/1/");
    await page.waitForLoadState("networkidle");

    // Letter detail uses uppercase "Fra" and "Til" labels (without colons)
    const article = page.locator("article");
    await expect(article).toBeVisible();
    await expect(article.getByText("Fra", { exact: true })).toBeVisible();
    await expect(article.getByText("Til", { exact: true })).toBeVisible();
  });

  test("should display letter sender name", async ({ page }) => {
    await page.goto("/letters/1/");
    await page.waitForLoadState("networkidle");

    // First letter is from Peter Maersk
    const content = await page.content();
    expect(content).toContain("Peter");
  });

  test("should display letter text content", async ({ page }) => {
    await page.goto("/letters/1/");
    await page.waitForLoadState("networkidle");

    // The letter detail page should have substantial text content in an article
    const article = page.locator("article");
    await expect(article).toBeVisible();

    const textContent = await article.textContent();
    expect(textContent).toBeTruthy();
    expect(textContent!.length).toBeGreaterThan(100);
  });

  test("should show a back link to the letter list", async ({ page }) => {
    await page.goto("/letters/1/");
    await page.waitForLoadState("networkidle");

    // The page has a "Tilbage til brevlisten" link back to the letter list
    const backLink = page.getByText("Tilbage til brevlisten");
    await expect(backLink).toBeVisible();
  });

  test("should navigate back to letter list via back link", async ({ page }) => {
    await page.goto("/letters/1/");
    await page.waitForLoadState("networkidle");

    // Click the back link — should go to /breve/
    const backLink = page.getByText("Tilbage til brevlisten");
    await backLink.click();

    await expect(page).toHaveURL("/breve/");
  });

  test("should load different letters correctly", async ({ page }) => {
    // Test letter 1
    await page.goto("/letters/1/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("article")).toBeVisible();

    // Test letter 10
    await page.goto("/letters/10/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("article")).toBeVisible();
  });

  test("should show letter navigation (previous/next)", async ({ page }) => {
    await page.goto("/letters/5/");
    await page.waitForLoadState("networkidle");

    // Should have Forrige (previous) and Næste (next) navigation links
    await expect(page.getByRole("link", { name: "Forrige" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Næste" })).toBeVisible();
  });

  test("should navigate to next letter", async ({ page }) => {
    await page.goto("/letters/1/");
    await page.waitForLoadState("networkidle");

    // Click the next navigation link
    await page.getByRole("link", { name: "Næste" }).click();

    await expect(page).toHaveURL("/letters/2/");
  });
});

test.describe("Static Site - Navigation", () => {
  test("should have all main navigation links in header", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The desktop header nav should contain all main section links
    const nav = page.locator("header nav");
    await expect(nav.getByText("Breve", { exact: true })).toBeVisible();
    await expect(nav.getByText("Om", { exact: true })).toBeVisible();
  });

  test("should navigate to about page via nav link", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const omLink = page.locator("header nav").getByText("Om", { exact: true });
    await omLink.click();

    await expect(page).toHaveURL("/about/");
  });

  test("should navigate from about page to letter list via nav", async ({
    page,
  }) => {
    await page.goto("/about/");
    await page.waitForLoadState("networkidle");

    const breveLink = page
      .locator("header nav")
      .getByText("Breve", { exact: true });
    await breveLink.click();

    await expect(page).toHaveURL("/breve/");
  });

  test("should handle direct URL navigation to a letter", async ({
    page,
  }) => {
    await page.goto("/letters/100/");
    await page.waitForLoadState("networkidle");

    // Should load the letter page (article element present)
    await expect(page.locator("article")).toBeVisible();
  });

  test("should handle browser back navigation", async ({ page }) => {
    // Start at letter list
    await page.goto("/breve/");
    await page.waitForLoadState("networkidle");

    // Navigate to a letter
    const firstCard = page.locator('a[href*="/letters/"]').first();
    await firstCard.click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/letters\/\d+\//);

    // Go back
    await page.goBack();
    await expect(page).toHaveURL("/breve/");
  });

  test("should navigate to search page", async ({ page }) => {
    await page.goto("/search/");
    await page.waitForLoadState("networkidle");

    // Search page should load and show content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test("should navigate to timeline page", async ({ page }) => {
    await page.goto("/timeline/");
    await page.waitForLoadState("networkidle");

    // Timeline page loads with content
    await expect(page.getByRole("heading", { name: "Tidslinje" })).toBeVisible();
  });

  test("should navigate to map page", async ({ page }) => {
    await page.goto("/map/");
    await page.waitForLoadState("networkidle");

    // Map page loads with content
    await expect(page.getByRole("heading", { name: "Kort" })).toBeVisible();
  });

  test("should navigate to statistics page", async ({ page }) => {
    await page.goto("/statistics/");
    await page.waitForLoadState("networkidle");

    // Statistics page loads with content
    await expect(page.getByRole("heading", { name: "Statistik" })).toBeVisible();
  });
});

test.describe("Static Site - About Page", () => {
  test("should display about page content", async ({ page }) => {
    await page.goto("/about/");
    await page.waitForLoadState("networkidle");

    // About page mentions the family project and has contact info
    const content = await page.content();
    expect(content).toContain("Jernkorset.dk");
    expect(content).toContain("Christian Dalager");
  });
});

test.describe("Static Site - Error Handling", () => {
  test("should handle non-existent letter gracefully", async ({ page }) => {
    await page.goto("/letters/99999/");

    // Static export produces a 404 or falls back; page should not crash
    await page.waitForLoadState("networkidle");
    const content = await page.content();
    // Page rendered something (didn't completely crash)
    expect(content.length).toBeGreaterThan(100);
  });

  test("should handle invalid letter ID format", async ({ page }) => {
    await page.goto("/letters/invalid/");
    await page.waitForLoadState("networkidle");

    const content = await page.content();
    // Page rendered something (didn't completely crash)
    expect(content.length).toBeGreaterThan(100);
  });
});

test.describe("Static Site - Responsive Design", () => {
  test("should be usable on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Site name in header should still be visible on mobile
    await expect(
      page.locator("header").getByText("Jernkorset", { exact: true })
    ).toBeVisible();
  });

  test("should show mobile hamburger menu on small viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Hamburger menu button should be visible on mobile
    const menuButton = page.getByRole("button", { name: "Skift menu" });
    await expect(menuButton).toBeVisible();
  });

  test("should be usable on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/letters/1/");
    await page.waitForLoadState("networkidle");

    // Letter content should be visible on tablet
    await expect(page.locator("article")).toBeVisible();
  });
});

test.describe("Static Site - Performance", () => {
  test("should load home page within 3 seconds", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });

  test("should load letter detail within 3 seconds", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/letters/1/");
    await page.waitForLoadState("networkidle");
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000);
  });
});
