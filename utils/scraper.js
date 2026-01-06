import puppeteer from "puppeteer";

export const checkWebsiteForKeyword = async (url, keyword, requiredContext) => {
  // Clear previous timer if it exists to stop the "Label exists" warning
  try {
    console.timeEnd("Scrape Duration");
  } catch (e) {}

  console.time("Scrape Duration");
  console.log(`\n--- 🚀 Checking: ${url} ---`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      // CRITICAL: Tell Puppeteer where Chrome is in Docker
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", // Writes temp files to disk, not RAM
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process", // Critical for 512MB RAM
      ],
    });

    const page = await browser.newPage();

    // Block heavy assets
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (
        ["image", "media", "font", "stylesheet", "other"].includes(
          req.resourceType()
        )
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Use standard User Agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // ==============================
    // 📦 AMAZON PINCODE FIX
    // ==============================
    if (url.includes("amazon")) {
      try {
        const locationText = await page.evaluate(
          () => document.getElementById("glow-ingress-line1")?.innerText
        );
        if (locationText && locationText.includes("Select your address")) {
          console.log("📍 Amazon needs Pincode...");
          await page.click("#nav-global-location-popover-link");
          await new Promise((r) => setTimeout(r, 2000));
          await page.type("#GLUXZipUpdateInput", "110001", { delay: 100 });
          await page.click("#GLUXZipUpdate");
          await new Promise((r) => setTimeout(r, 2000));
          await page.reload({ waitUntil: "domcontentloaded" });
        }
      } catch (err) {
        console.log("⚠️ Pincode setup skipped:", err.message);
      }
    }

    // ==============================
    // 🖱️ CLICK LOGIC (Amazon & Flipkart)
    // ==============================
    if (url.includes("flipkart.com")) {
      try {
        await page.evaluate(() => window.scrollBy(0, 500));
        await new Promise((r) => setTimeout(r, 1000));
        const clickResult = await page.evaluate(() => {
          const spans = Array.from(
            document.querySelectorAll("span, div, a, li")
          );
          for (let el of spans) {
            if (
              el.innerText &&
              el.innerText.trim().toLowerCase() === "view plans"
            ) {
              el.click();
              return "Clicked 'View Plans'";
            }
          }
          const linkButtons = document.querySelectorAll("._3X7Jj1");
          for (let btn of linkButtons) {
            const parentText = btn.parentElement
              ? btn.parentElement.innerText.toLowerCase()
              : "";
            if (parentText.includes("no cost") || parentText.includes("emi")) {
              btn.click();
              return "Clicked Class ._3X7Jj1";
            }
          }
          return false;
        });
        if (clickResult) {
          console.log(`🖱️ Flipkart: ${clickResult}`);
          await new Promise((r) => setTimeout(r, 4000));
        }
      } catch (err) {
        console.log("⚠️ Flipkart click error:", err.message);
      }
    } else if (url.includes("amazon")) {
      try {
        console.log("🕵️ Detected Amazon. Looking for EMI...");
        await page.evaluate(() => window.scrollBy(0, 300));
        await new Promise((r) => setTimeout(r, 2000));
        const emiButton = await page.$("#incontext_emiLink");
        if (emiButton) {
          await emiButton.click();
          console.log("🖱️ Clicked ID");
        } else {
          await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll("a, span"));
            for (let el of links) {
              if (el.innerText?.toLowerCase() === "emi options") el.click();
            }
          });
        }
        await new Promise((r) => setTimeout(r, 5000));
      } catch (err) {
        console.log("⚠️ Amazon click error:", err.message);
      }
    }

    // ==============================
    // 🔍 SEARCH
    // ==============================
    const pageText = await page.evaluate(() =>
      document.body.innerText.toLowerCase().replace(/\s+/g, " ")
    );
    const mainWord = keyword.toLowerCase();
    const contextWord = requiredContext ? requiredContext.toLowerCase() : "";

    if (pageText.includes(mainWord) && pageText.includes(contextWord)) {
      let searchIndex = 0;
      while ((searchIndex = pageText.indexOf(mainWord, searchIndex)) !== -1) {
        const start = Math.max(0, searchIndex - 3000);
        const end = Math.min(pageText.length, searchIndex + 3000);
        const windowText = pageText.substring(start, end);

        if (windowText.includes(contextWord)) {
          console.log(`✅ MATCH FOUND!`);
          await browser.close();
          console.timeEnd("Scrape Duration");
          return true;
        }
        searchIndex += mainWord.length;
      }
    }

    console.log("❌ No Match.");
    await browser.close();
    console.timeEnd("Scrape Duration");
    return false;
  } catch (error) {
    if (browser) await browser.close();
    console.timeEnd("Scrape Duration");
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
};
