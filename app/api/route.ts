import { NextRequest, NextResponse } from "next/server";

type CrawlApiResponse = {
    success?: boolean;
    pages?: unknown[];
    error?: string;
};

function validateUrl(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) return "URL is required";

    try {
        new URL(trimmed);
        return null;
    } catch {
        return "Invalid URL";
    }
}

async function callCrawler(origin: string, url: string): Promise<CrawlApiResponse> {
    const crawlerUrl = `${origin}/api/crawl?url=${encodeURIComponent(url)}`;
    const response = await fetch(crawlerUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
    });

    const raw = await response.text();
    if (!raw) {
        throw new Error("Crawler returned an empty response");
    }

    let parsed: CrawlApiResponse;
    try {
        parsed = JSON.parse(raw) as CrawlApiResponse;
    } catch {
        throw new Error("Crawler returned invalid JSON");
    }

    if (!response.ok) {
        throw new Error(parsed.error ?? `Crawler failed with status ${response.status}`);
    }

    return parsed;
}

async function callLLM(origin: string, pages: unknown[]): Promise<string[]> {
    try {
        const response = await fetch(`${origin}/api/LLM`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pagesData: pages }),
        });

        if (!response.ok) {
            throw new Error(`LLM request failed with status ${response.status}`);
        }

        const result = await response.json();

        if (Array.isArray(result)) {
            return result;
        }

        if (Array.isArray(result.searchTerms)) {
            return result.searchTerms;
        }

        if (typeof result.text === "string") {
            return [result.text];
        }

        return [];
    } catch (error) {
        console.error("Error calling LLM:", error);
        throw new Error("Failed to call LLM");
    }
}

async function handle(url: string, request: NextRequest) {
    const validationError = validateUrl(url);
    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
    }

    try {
        const crawlData = await callCrawler(request.nextUrl.origin, url);
        const searchTerms = await callLLM(request.nextUrl.origin, crawlData.pages ?? []);
        console.log("Search terms:", searchTerms);
        return NextResponse.json({ ...crawlData, searchTerms });
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch the URL. Please ensure it's valid and try again.",
            },
            { status: 502 },
        );
    }
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get("url") ?? "";
    return handle(url, request);
}

export async function POST(request: NextRequest) {
    let body: { url?: string };

    try {
        body = (await request.json()) as { url?: string };
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    return handle(body.url ?? "", request);
}
