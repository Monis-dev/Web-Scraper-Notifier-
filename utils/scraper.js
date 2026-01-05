import puppeteer from "puppeteer";

export const checkWebsiteForKeyword = async (url, keyword, requiredContext) => {
  console.time("Scrape Duration");
  console.log(`\n--- 🚀 Checking: ${url} ---`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage", 
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process", 
        "--disable-extensions",
      ],
    });

    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (
        ["image", "media", "font", "stylesheet", "image", "other"].includes(
          type
        )
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // ==============================
    // 🛍️ FLIPKART LOGIC
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
    }

    // ==============================
    // 📦 AMAZON LOGIC (DEBUGGER)
    // ==============================
    else if (url.includes("amazon")) {
      try {
        console.log("🕵️ Detected Amazon. Analyzing page...");
        await page.evaluate(() => window.scrollBy(0, 400));
        await new Promise((r) => setTimeout(r, 2000));

        // DEBUG: Print all "EMI" related text found on the screen
        const emiTexts = await page.evaluate(() => {
          const allElements = document.querySelectorAll("a, span, div");
          let results = [];
          allElements.forEach((el) => {
            if (
              el.innerText &&
              el.innerText.toLowerCase().includes("emi options") &&
              el.innerText.length < 50
            ) {
              results.push(
                `Found Tag: <${el.tagName}> Text: "${el.innerText}"`
              );
            }
          });
          return [...new Set(results)]; // Remove duplicates
        });

        console.log("🔎 VISIBLE EMI LINKS FOUND:", emiTexts);

        // CLICKER LOGIC
        const clickResult = await page.evaluate(() => {
          // 1. Try strict "EMI options" link
          const links = Array.from(document.querySelectorAll("a, span"));
          for (let el of links) {
            const t = el.innerText ? el.innerText.trim().toLowerCase() : "";
            if (t === "emi options" || t === "details") {
              // Must be inside a relevant container
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
          console.log("⏳ Waiting for EMI data...");
          await new Promise((r) => setTimeout(r, 5000));

          // SMART POPUP READER (Filters out "Feedback" garbage)
          const bankData = await page.evaluate(() => {
            // Get ALL popup contents
            const popups = Array.from(
              document.querySelectorAll(".a-popover-content, .a-popover-inner")
            );

            for (let p of popups) {
              const t = p.innerText.toLowerCase();
              // Only return if it looks like financial data
              if (
                t.includes("interest") ||
                t.includes("bank") ||
                t.includes("credit card") ||
                t.includes("amazon pay")
              ) {
                return t;
              }
            }
            return null;
          });

          if (bankData) {
            console.log("\n🏦 VALID BANK DATA RECEIVED:");
            console.log(bankData.substring(0, 200).replace(/\n/g, ", "));
          } else {
            console.log(
              "⚠️ Popup opened, but no financial text found (Might need Pincode)."
            );
          }
        } else {
          console.log("⚠️ Could not click any EMI button.");
        }
      } catch (err) {
        console.log("⚠️ Amazon click error:", err.message);
      }
    }

    // ==============================
    // 🔍 TEXT SEARCH
    // ==============================
    const pageText = await page.evaluate(() =>
      document.body.innerText.toLowerCase().replace(/\s+/g, " ")
    );
    const mainWord = keyword.toLowerCase();
    const contextWord = requiredContext ? requiredContext.toLowerCase() : "";

    if (pageText.includes(mainWord) && pageText.includes(contextWord)) {
      let searchIndex = 0;
      while ((searchIndex = pageText.indexOf(mainWord, searchIndex)) !== -1) {
        // Massive range for Amazon HTML structure
        const start = Math.max(0, searchIndex - 3500);
        const end = Math.min(pageText.length, searchIndex + 3500);
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
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
};
