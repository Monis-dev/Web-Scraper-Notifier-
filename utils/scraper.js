import puppeteer from "puppeteer";

export const checkWebsiteForKeyword = async (url, keyword, requiredContext) => {
  // Clear previous timer
  try {
    console.timeEnd("Scrape Duration");
  } catch (e) {}

  console.time("Scrape Duration");
  console.log(`\n--- 🚀 Checking: ${url} ---`);

  let browser;
  try {
    // 1. CLOUD CONFIGURATION
    const isProduction = process.env.PUPPETEER_EXECUTABLE_PATH;
    console.log(isProduction ? "⚙️ Mode: Cloud (Docker)" : "⚙️ Mode: Local");

    const launchConfig = {
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080", // Browser window size
      ],
    };

    if (isProduction) {
      launchConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      launchConfig.args.push("--single-process");
    }

    browser = await puppeteer.launch(launchConfig);
    const page = await browser.newPage();

    // 2. FORCE DESKTOP VIEWPORT (Critical for Amazon Layout)
    await page.setViewport({ width: 1920, height: 1080 });

    // 3. BALANCED BLOCKING
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "media"].includes(req.resourceType())) {
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
    // 📦 AMAZON PINCODE FIX (REQUIRED FOR RENDER)
    // ==============================
    if (url.includes("amazon")) {
      try {
        console.log("📍 Checking Amazon Location...");
        // Check if the location bar says "Select your address" or something foreign
        const locationText = await page.evaluate(() => {
          const el = document.getElementById("glow-ingress-line1");
          return el ? el.innerText : "";
        });

        console.log(`📍 Current Location detected as: "${locationText}"`);

        // Always try to set it to 462030 on Cloud to be safe
        if (isProduction || locationText.includes("Select your address")) {
          console.log("📍 Injecting Indian Pincode (462030)...");

          await page.click("#nav-global-location-popover-link");
          await new Promise((r) => setTimeout(r, 2000));

          // Type Pincode
          await page.type("#GLUXZipUpdateInput", "462030", { delay: 100 });

          // Click Apply/Update
          // Sometimes ID is GLUXZipUpdate, sometimes it's an input button
          const applied = await page.evaluate(() => {
            const btn =
              document.querySelector("#GLUXZipUpdate input") ||
              document.getElementById("GLUXZipUpdate");
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          });

          if (applied) {
            console.log("📍 Pincode Submitted. Reloading...");
            await new Promise((r) => setTimeout(r, 2000));
            await page.reload({ waitUntil: "domcontentloaded" });
          } else {
            console.log("⚠️ Could not find Pincode Apply button.");
          }
        }
      } catch (err) {
        console.log("⚠️ Pincode setup skipped:", err.message);
      }
    }

    // ==============================
    // 🖱️ CLICK LOGIC
    // ==============================
    if (url.includes("flipkart.com")) {
      try {
        await page.evaluate(() => window.scrollBy(0, 500));
        await new Promise((r) => setTimeout(r, 1000));

        // Smart Clicker
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
        console.log("🕵️ Detected Amazon. Hunting for buttons...");
        await page.evaluate(() => window.scrollBy(0, 300));
        await new Promise((r) => setTimeout(r, 2000));

        // Try to click ID first
        const idBtn = await page.$("#incontext_emiLink");
        if (idBtn) {
          await idBtn.click();
          console.log("🖱️ Clicked ID #incontext_emiLink");
        } else {
          // Fallback: Click text (The one that worked locally for you)
          const clickedText = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll("a, span, div"));
            for (let el of links) {
              const t = el.innerText ? el.innerText.trim().toLowerCase() : "";
              if (t === "emi options" || t === "emi") {
                el.click();
                return `Clicked text "${t}"`;
              }
            }
            return null;
          });
          if (clickedText) console.log(`🖱️ ${clickedText}`);
        }

        console.log("⏳ Waiting for Popup...");
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

    // DEBUG: Print Location Context
    // This helps us know if the Pincode worked
    const deliveryTextIndex = pageText.indexOf("deliver to");
    if (deliveryTextIndex !== -1) {
      console.log(
        `📍 Page Delivery Context: "...${pageText.substring(
          deliveryTextIndex,
          deliveryTextIndex + 50
        )}..."`
      );
    }

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
    console.error(`❌ Browser Error: ${error.message}`);
    return false;
  }
};
