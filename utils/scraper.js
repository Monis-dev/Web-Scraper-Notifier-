import puppeteer from "puppeteer";

async function safeGoto(page, url, retries = 3) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`🌐 Navigating (attempt ${i})`);
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      return true;
    } catch (err) {
      console.log(`⚠️ Navigation failed: ${err.message}`);
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// Strategy 1: Minimal interaction (fastest, lowest detection)
async function flipkartMinimalStrategy(page, keyword, requiredContext) {
  console.log("📝 Flipkart Strategy 1: Minimal");

  await page.evaluate(() => window.scrollBy(0, 300));
  await new Promise((r) => setTimeout(r, 1500));

  const pageText = await page.evaluate(() =>
    document.body.innerText.toLowerCase().replace(/\s+/g, " ")
  );

  return searchInText(pageText, keyword, requiredContext);
}

// Strategy 2: Single click attempt (medium risk)
async function flipkartSingleClickStrategy(page, keyword, requiredContext) {
  console.log("📝 Flipkart Strategy 2: Single Click");

  await page.evaluate(() => window.scrollBy(0, 300));
  await new Promise((r) => setTimeout(r, 1000));

  const clicked = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("span, div, a"));
    for (let el of elements) {
      const text = el.innerText?.toLowerCase().trim();
      if (text === "view plans" || text === "available offers") {
        el.click();
        return true;
      }
    }
    return false;
  });

  if (clicked) {
    console.log("🖱️ Clicked offer trigger");
    await new Promise((r) => setTimeout(r, 3000));
  }

  const pageText = await page.evaluate(() =>
    document.body.innerText.toLowerCase().replace(/\s+/g, " ")
  );

  return searchInText(pageText, keyword, requiredContext);
}

// Strategy 3: Mobile user agent (sometimes bypasses heavy JS)
async function flipkartMobileStrategy(page, url, keyword, requiredContext) {
  console.log("📝 Flipkart Strategy 3: Mobile Mode");

  await page.setUserAgent(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
  );

  await page.setViewport({ width: 375, height: 667 });

  // Re-navigate with mobile UA
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2000));

  const pageText = await page.evaluate(() =>
    document.body.innerText.toLowerCase().replace(/\s+/g, " ")
  );

  return searchInText(pageText, keyword, requiredContext);
}

// Helper: Search text with context window
function searchInText(pageText, keyword, requiredContext) {
  const mainWord = keyword.toLowerCase();
  const contextWord = requiredContext ? requiredContext.toLowerCase() : "";

  if (!pageText.includes(mainWord) || !pageText.includes(contextWord)) {
    return false;
  }

  let searchIndex = 0;
  while ((searchIndex = pageText.indexOf(mainWord, searchIndex)) !== -1) {
    const start = Math.max(0, searchIndex - 3500);
    const end = Math.min(pageText.length, searchIndex + 3500);
    const windowText = pageText.substring(start, end);

    if (windowText.includes(contextWord)) {
      return true;
    }
    searchIndex += mainWord.length;
  }

  return false;
}

export const checkWebsiteForKeyword = async (url, keyword, requiredContext) => {
  console.time("Scrape Duration");
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      slowMo: 50,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // ==============================
    // 🛍️ FLIPKART MULTI-STRATEGY
    // ==============================
    if (url.includes("flipkart.com")) {
      await safeGoto(page, url);

      // Try strategies in order of reliability
      const strategies = [
        () => flipkartMinimalStrategy(page, keyword, requiredContext),
        () => flipkartSingleClickStrategy(page, keyword, requiredContext),
        () => flipkartMobileStrategy(page, url, keyword, requiredContext),
      ];

      for (let i = 0; i < strategies.length; i++) {
        try {
          const result = await strategies[i]();
          if (result) {
            console.log(`✅ Match found with Strategy ${i + 1}`);
            await browser.close();
            console.timeEnd("Scrape Duration");
            return true;
          }
        } catch (err) {
          console.log(`⚠️ Strategy ${i + 1} failed: ${err.message}`);
        }
      }

      console.log("❌ All Flipkart strategies exhausted.");
      await browser.close();
      console.timeEnd("Scrape Duration");
      return false;
    }

    // ==============================
    // 📦 AMAZON LOGIC (STABLE)
    // ==============================
    else if (url.includes("amazon")) {
      await safeGoto(page, url);

      try {
        console.log("🕵️ Detected Amazon. Analyzing page...");
        await page.evaluate(() => window.scrollBy(0, 400));
        await new Promise((r) => setTimeout(r, 2000));

        const clickResult = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll("a, span"));
          for (let el of links) {
            const t = el.innerText ? el.innerText.trim().toLowerCase() : "";
            if (t === "emi options" || t === "details") {
              const parent = el.closest(".a-section") || el.parentElement;
              const parentText = parent ? parent.innerText.toLowerCase() : "";

              if (
                parentText.includes("emi") ||
                parentText.includes("no cost")
              ) {
                el.click();
                return `Clicked "${t}"`;
              }
            }
          }
          return false;
        });

        if (clickResult) {
          console.log(`🖱️ Amazon: ${clickResult}`);
          await new Promise((r) => setTimeout(r, 5000));
        }
      } catch (err) {
        console.log("⚠️ Amazon click error:", err.message);
      }
    } else {
      await safeGoto(page, url);
    }

    // ==============================
    // 🔍 TEXT SEARCH (Generic)
    // ==============================
    const pageText = await page.evaluate(() =>
      document.body.innerText.toLowerCase().replace(/\s+/g, " ")
    );

    const result = searchInText(pageText, keyword, requiredContext);

    if (result) {
      console.log(`✅ MATCH FOUND!`);
    } else {
      console.log("❌ No Match.");
    }

    await browser.close();
    console.timeEnd("Scrape Duration");
    return result;
  } catch (error) {
    if (browser) await browser.close();
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
};
