// utils/scraper.js
import axios from "axios";
import * as cheerio from "cheerio";

export const checkWebsiteForKeyword = async (url, keyword) => {
  console.time("Scrape Duration");

  try {
    console.log(`\n--- Checking: ${url} ---`);

    const response = await axios.get(url, {
      timeout: 10000, // Wait up to 10 seconds
      headers: {
        // Use a very recent Mac/Chrome User-Agent
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        // These headers make us look like a real browser
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
      },
    });

    console.log(`Status: ${response.status}`);

    const $ = cheerio.load(response.data);

    // DEBUG: Print the title of the page we got
    const pageTitle = $("title").text().trim();
    console.log(`📄 Page Title: "${pageTitle}"`);

    // If title says "Robot Check", we failed.
    if (pageTitle.includes("Robot Check") || pageTitle.includes("Captcha")) {
      console.log("❌ Amazon blocked us. Requires Puppeteer.");
      return false;
    }

    // Clean up HTML for faster search
    $("script").remove();
    $("style").remove();

    const pageText = $("body").text().toLowerCase();
    const searchKeyword = keyword.toLowerCase();

    const isFound = pageText.includes(searchKeyword);

    console.timeEnd("Scrape Duration");
    return isFound;
  } catch (error) {
    console.timeEnd("Scrape Duration");
    console.error(`❌ ERROR: ${error.message}`);
    return false;
  }
};
