import puppeteer from "puppeteer";

export const checkWebsiteForKeyword = async (url, keyword, requiredContext) => {
  // Clear any leftover timer warnings from previous runs
  try {
    console.timeEnd("Scrape Duration");
  } catch (e) {}

  console.time("Scrape Duration");
  console.log(`\n--- 🚀 Checking: ${url} ---`);

  let browser;
  try {
    // ==========================================
    // ⚙️ 1. CLOUD vs. LOCAL CONFIGURATION
    // ==========================================
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
        "--window-size=1920,1080", // Force a desktop window size
      ],
    };

    // If running on Render (Docker), add specific settings
    if (isProduction) {
      launchConfig.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      launchConfig.args.push("--single-process"); // Crucial for low-RAM environments
    }

    browser = await puppeteer.launch(launchConfig);
    const page = await browser.newPage();

    // ==========================================
    // ⚙️ 2. PAGE SETUP & ANTI-BOT MEASURES
    // ==========================================
    await page.setViewport({ width: 1920, height: 1080 });

    // Block heavy resources but allow CSS/Fonts for layout
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "media", "font"].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Use a common, realistic User Agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate and wait until the network is quiet (handles lazy-loading)
    console.log("🌐 Navigating...");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });

    // ==========================================
    // 📦 3. AMAZON PINCODE INJECTION (Cloud Only)
    // ==========================================
    if (url.includes("amazon") && isProduction) {
      try {
        const needsPincode = await page.evaluate(() => {
          const el = document.getElementById("glow-ingress-line1");
          return (
            el && el.innerText.toLowerCase().includes("select your address")
          );
        });

        if (needsPincode) {
          console.log(
            "📍 Cloud Mode: Amazon needs a location. Injecting Pincode '462030'..."
          );
          await page.click("#nav-global-location-popover-link");
          await new Promise((r) => setTimeout(r, 2000));
          await page.type("#GLUXZipUpdateInput", "462030", { delay: 100 });
          await page.evaluate(() => {
            const btn =
              document.querySelector("#GLUXZipUpdate input") ||
              document.getElementById("GLUXZipUpdate");
            if (btn) btn.click();
          });
          await new Promise((r) => setTimeout(r, 2000));
          console.log("📍 Pincode submitted. Reloading page...");
          await page.reload({ waitUntil: "networkidle2" });
        }
      } catch (err) {
        console.log("⚠️ Pincode injection failed:", err.message);
      }
    }

    // ==========================================
    // 🖱️ 4. CONTEXTUAL CLICK LOGIC
    // ==========================================
    let clickHappened = false;

    if (url.includes("flipkart.com")) {
      try {
        console.log("🕵️ Detected Flipkart. Hunting for EMI button...");
        await page.evaluate(() => window.scrollBy(0, 800)); // Scroll deeper for Flipkart layout
        await new Promise((r) => setTimeout(r, 2000));

        const clickResult = await page.evaluate(() => {
          // Find the entire "Offers" or "EMI" section first
          const sections = Array.from(document.querySelectorAll("div"));
          for (let section of sections) {
            const text = section.innerText
              ? section.innerText.toLowerCase()
              : "";
            if (text.includes("no cost emi") || text.includes("emi starting")) {
              // Now, find a clickable link *inside* this specific section
              const button = section.querySelector(
                'span, a, div[class*="_3X7Jj1"]'
              );
              if (button) {
                button.click();
                return `Clicked "${button.innerText}" inside the EMI section`;
              }
            }
          }
          return null;
        });

        if (clickResult) {
          console.log(`🖱️ ${clickResult}`);
          clickHappened = true;
        }
      } catch (err) {
        console.log("⚠️ Flipkart click error:", err.message);
      }
    } else if (url.includes("amazon")) {
      try {
        console.log("🕵️ Detected Amazon. Hunting for EMI button...");
        await page.evaluate(() => window.scrollBy(0, 300));
        await new Promise((r) => setTimeout(r, 2000));

        const idBtn = await page.$("#incontext_emiLink");
        if (idBtn) {
          await idBtn.click();
          clickHappened = true;
          console.log("🖱️ Clicked Amazon ID #incontext_emiLink");
        }
      } catch (err) {
        console.log("⚠️ Amazon click error:", err.message);
      }
    }

    // ==========================================
    // 🔍 5. SEARCH & VERIFY
    // ==========================================
    if (clickHappened) {
      console.log("⏳ Waiting 5 seconds for popup to load...");
      await new Promise((r) => setTimeout(r, 5000));
    } else {
      console.log(
        "⚠️ Could not find any button to click, searching static page text only."
      );
    }

    const pageText = await page.evaluate(() =>
      document.body.innerText.toLowerCase().replace(/\s+/g, " ")
    );
    const mainWord = keyword.toLowerCase();
    const contextWord = requiredContext ? requiredContext.toLowerCase() : "";

    console.log(
      `\n📝 Searching for "${mainWord}" near "${contextWord || "N/A"}"...`
    );

    if (
      pageText.includes(mainWord) &&
      (!contextWord || pageText.includes(contextWord))
    ) {
      let searchIndex = 0;
      while ((searchIndex = pageText.indexOf(mainWord, searchIndex)) !== -1) {
        const start = Math.max(0, searchIndex - 3500);
        const end = Math.min(pageText.length, searchIndex + 3500);
        const windowText = pageText.substring(start, end);

        if (!contextWord || windowText.includes(contextWord)) {
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
