import { NextRequest, NextResponse } from "next/server";

type CrawlApiResponse = {
    success?: boolean;
    pages?: unknown[];
    error?: string;
};

type reddit_json_type = {
    id: string;
    title: string;
    text: string;
    subreddit: string;
    threadUrl: string;
    isExternal: boolean;
};

type LLMResult = {
    description: string;
    searchTerms: string[];
};


type posts = {
    post_id: string;
    subreddit: string;
    reasoning: string;
    reply_content: string;
}


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

async function callLLM(origin: string, pages: unknown[]): Promise<LLMResult> {
    try {
        const response = await fetch(`${origin}/api/LLM`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pagesData: pages }), // Send description to LLM as well
        });

        if (!response.ok) {
            const rawError = await response.text();
            let details = rawError;
            try {
                const parsed = JSON.parse(rawError) as { error?: unknown };
                if (typeof parsed.error === "string" && parsed.error.trim()) {
                    details = parsed.error;
                }
            } catch {
                // Keep plain text body as details when JSON parsing fails.
            }

            throw new Error(`LLM request failed with status ${response.status}${details ? `: ${details}` : ""}`);
        }

        const result = await response.json();

        if (result && typeof result === "object" && !Array.isArray(result)) {
            const searchTerms = Array.isArray((result as { searchTerms?: unknown }).searchTerms)
                ? (result as { searchTerms: unknown[] }).searchTerms
                : Array.isArray((result as { search_terms?: unknown }).search_terms)
                    ? (result as { search_terms: unknown[] }).search_terms
                    : [];

            return {
                description: typeof (result as { description?: unknown }).description === "string"
                    ? (result as { description: string }).description
                    : "",
                searchTerms: searchTerms.map((item) => String(item)).filter(Boolean),
            };
        }

        if (Array.isArray(result)) {
            return {
                description: "",
                searchTerms: result.map((item) => String(item)).filter(Boolean),
            };
        }

        return {
            description: "",
            searchTerms: [],
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to call LLM";
        console.error("Error calling LLM:", message);
        throw new Error(message);
    }
}

async function getRedditPosts(origin: string, searchTerms: string[]): Promise<reddit_json_type[]> {
        if (searchTerms.length === 0) {
            console.warn("No search terms provided to getRedditPosts");
            return [];
        }
        const response = await fetch(`${origin}/api/reddit-search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keywords: searchTerms }),
        });
        
        if (!response.ok) {
            throw new Error(`Reddit search failed with status ${response.status}`);
        }
        const reddit_json = await response.json();
        console.log("Reddit search response:", reddit_json);
        return reddit_json ?? [];
}

async function getPostContent(origin: string, reddit_json: reddit_json_type[], websiteData: { description: string; url: string }): Promise<posts[]> {
    const res = await fetch(`${origin}/api/GenLLM`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reddit_json, websiteData }),
    });

    if (!res.ok) {
        const rawError = await res.text();
        throw new Error(`Generate post failed with status ${res.status}${rawError ? `: ${rawError}` : ""}`);
    }

    const finalPostContent = await res.json();
    return finalPostContent;
}


async function handle(url: string, crequest: NextRequest) {
    const validationError = validateUrl(url);
    if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
    }

    try {
        // crawl the given website and get the data
        const crawlData = await callCrawler(crequest.nextUrl.origin, url);
        
        // call the LLM with the crawled data to get search terms
        const llmResult = await callLLM(crequest.nextUrl.origin, crawlData.pages ?? []);
        const searchTerms = llmResult.searchTerms;
        console.log("Search terms:", searchTerms);
        console.log("Website description:", llmResult.description);
        
        // call reddit search with the search terms and get relevant posts
        const reddit_json = await getRedditPosts(crequest.nextUrl.origin, searchTerms);
        console.log("Reddit search results:", reddit_json);

        // Skip final post generation when there are no candidate Reddit threads.
        const finalPostContent = reddit_json.length > 0
            ? await getPostContent(crequest.nextUrl.origin, reddit_json, {
                description: llmResult.description,
                url,
            })
            : [];
        console.log("Final post content:", finalPostContent);

        return NextResponse.json({ ...crawlData, description: llmResult.description, searchTerms, finalPostContent });
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
