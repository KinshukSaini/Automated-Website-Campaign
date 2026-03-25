import axios from "axios";
import * as cheerio from "cheerio";
import { NextRequest, NextResponse } from "next/server";

const visited = new Set<string>();

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "URL is required" },
      { status: 400 }
    );
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL" },
      { status: 400 }
    );
  }

  try {
    visited.clear();

    const data = await crawl(url, 2);

    return NextResponse.json({
      success: true,
      pages: data,
    });

  } catch (err) {
    return NextResponse.json(
      { error: "Crawling failed" },
      { status: 500 }
    );
  }
}

async function crawl(url: string, depth = 1): Promise<any[]> {
  if (visited.has(url) || depth === 0) return [];

  visited.add(url);

  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      timeout: 5000,
    });

    const $ = cheerio.load(data);

    const pageData = extractData($, url);

    const links: string[] = [];
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (href && href.startsWith("http")) {
        links.push(href);
      }
    });

    const results = [pageData];

    for (const link of links.slice(0, 3)) {
      const childData = await crawl(link, depth - 1);
      results.push(...childData);
    }

    return results;

  } catch {
    return [];
  }
}

function extractData($: cheerio.CheerioAPI, url: string) {
  // Remove unwanted elements (noise)
  $("script, style, noscript, iframe, nav, footer, header").remove();

  const title = $("title").text().trim();

  const description =
    $('meta[name="description"]').attr("content") || "";

  const headings = $("h1, h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const paragraphs = $("p")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(text => text.length > 50); // ignore tiny junk text

  const content = paragraphs.join(" ").slice(0, 3000); // limit size

  return {
    url,
    title,
    description,
    headings,
    content, // THIS is the main readable text
  };
}