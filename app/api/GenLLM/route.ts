import {GoogleGenAI} from '@google/genai';
import {NextRequest, NextResponse} from 'next/server';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});

type posts = {
    post_id: string;
    subreddit: string;
    reasoning: string;
    reply_content: string;
}

function parseLLMResponse(aiResponseString : string) : posts[] {
  try {
    const normalized = aiResponseString
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    // Capture full array/object blocks so nested JSON can still be parsed.
    const arrayMatch = normalized.match(/\[[\s\S]*\]/);
    const objectMatch = normalized.match(/\{[\s\S]*\}/);
    const match = arrayMatch ?? objectMatch;

    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) {
        return parsed as posts[];
      }
      if (parsed && typeof parsed === 'object') {
        return [parsed as posts];
      }
      throw new Error("Parsed JSON is neither an array nor an object");
    } else {
      throw new Error("No JSON found in AI response");
    }
  } catch (error) {
    console.error("Failed to parse AI JSON:", error, "Response (truncated):", aiResponseString.substring(0, 500));
    return []; // Return empty array as fallback
  }
}

export async function POST(request: NextRequest) {
    let req: { websiteData?: unknown; reddit_json?: unknown };
    try {
      req = (await request.json()) as { websiteData?: unknown; reddit_json?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const websiteData = req.websiteData;
    const reddit_json = req.reddit_json;

    console.log("Received Reddit JSON");


    if (!Array.isArray(reddit_json)) {
    return NextResponse.json({ error: "reddit_json must be an array" }, { status: 400 });
    }

    if (!websiteData || typeof websiteData !== "object") {
    return NextResponse.json({ error: "websiteData must be an object" }, { status: 400 });
    }

    const description = typeof (websiteData as { description?: unknown }).description === "string"
      ? (websiteData as { description: string }).description
      : "";
    const websiteUrl = typeof (websiteData as { url?: unknown }).url === "string"
      ? (websiteData as { url: string }).url
      : "";

    if (reddit_json.length === 0) {
      return NextResponse.json([]);
    }

    if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
    }

    const prompt = `
        [ROLE]
        You are a Community Success Agent for a startup. Your goal is to find genuine "Problem-Solution Fit" between a website and specific Reddit discussions.

        [CONTEXT]
        Website Description: ${description}
        Website Link: ${websiteUrl}

        [TASK]
        1. EVALUATE: Analyze the provided Reddit posts. Determine which ones are "High Intent" (the user is actively seeking a solution, complaining about a specific pain point, or asking for a tool recommendation).
        2. PERSONA: Act as a helpful peer "stumbled upon" the thread. 
        3. WRITE: Draft a contextual REPLY to the most relevant posts. 

        [GUIDELINES for THE REPLY]
        - Start by acknowledging the user's specific problem mentioned in their post.
        - Provide a small piece of general advice or a "pro-tip" FIRST to show value.
        - Introduce the website as a potential solution: "I actually worked on/found this tool called [Name] that does [X]...".
        - Keep the tone humble, helpful, and conversational. Avoid "Marketing-speak" (e.g., no "Unlock your potential" or "Revolutionary").
        - keep it concise - no more than 150 words.

        [DATA]
        Reddit Posts: ${JSON.stringify(reddit_json)}

        [OUTPUT]
        Return ONLY a JSON array of objects with the following structure:
        [
            {
                "post_id": "The ID of the specific Reddit post/comment you are replying to",
                "subreddit": "r/example",
                "reasoning": "Why this specific thread is a perfect match.",
                "reply_content": "The actual text of the reply, including the website link naturally."
            }
        ]
    `;
    try {
      const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: prompt,
      });

      const parsedPosts = parseLLMResponse(response.text ?? "");
      console.log("Parsed LLM Response:", parsedPosts);
      return NextResponse.json(parsedPosts);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate post content";
      console.error("GenLLM generateContent failed:", message);
      return NextResponse.json({ error: message }, { status: 502 });
    }
}
