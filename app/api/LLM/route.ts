import {GoogleGenAI} from '@google/genai';
import {NextRequest, NextResponse} from 'next/server';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});

type LLMOutput = {
  description: string;
  searchTerms: string[];
};

function toSearchTerms(text: string): string[] {
  const directParse = (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })();

  if (Array.isArray(directParse)) {
    return directParse
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 5);
  }

  const bracketMatch = text.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    try {
      const parsed = JSON.parse(bracketMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 5);
      }
    } catch {
      // Keep fallback parsing below.
    }
  }

  return text
    .split(/\r?\n|,/)
    .map((item) => item.replace(/^[-*\d.\s"']+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function toLLMOutput(text: string): LLMOutput {
  const parseCandidate = (candidate: string): LLMOutput | null => {
    try {
      const parsed = JSON.parse(candidate) as {
        description?: unknown;
        search_terms?: unknown;
        searchTerms?: unknown;
      };

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }

      const rawTerms = Array.isArray(parsed.search_terms)
        ? parsed.search_terms
        : Array.isArray(parsed.searchTerms)
          ? parsed.searchTerms
          : [];

      const searchTerms = rawTerms
        .map((item) => String(item).trim())
        .filter(Boolean)
        .slice(0, 5);

      const description = typeof parsed.description === "string"
        ? parsed.description.trim()
        : "";

      return { description, searchTerms };
    } catch {
      return null;
    }
  };

  const direct = parseCandidate(text);
  if (direct) {
    return direct;
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    const fromObject = parseCandidate(objectMatch[0]);
    if (fromObject) {
      return fromObject;
    }
  }

  return {
    description: "",
    searchTerms: toSearchTerms(text),
  };
}

export async function POST(request: NextRequest) {
  let body: { pagesData?: unknown };
  try {
    body = (await request.json()) as { pagesData?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pagesData } = body;

  if (!Array.isArray(pagesData)) {
    return NextResponse.json({ error: "pagesData must be an array" }, { status: 400 });
  }

  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
  }

  const prompt =`
  [ROLE] 
  You are an expert Growth Strategist. Analyze the provided website data to understand its core value proposition and identify where its potential users hang out on Reddit.

  [TASK]
  1. UNDERSTAND: Determine exactly what problem this website solves and for whom.
  2. DESCRIBE: Write a 1-sentence "Elevator Pitch" that focuses on the "Pain Point" solved.
  3. SEARCH: Generate 5 high-intent search phrases. These should not just be keywords, but "intent phrases" (e.g., instead of "legal ai", use "how to automate case law research").

  [OUTPUT FORMAT]
  You MUST return ONLY a valid JSON object with this exact structure:
  {
    "description": "A concise 1-sentence explanation of what the tool does and the specific problem it solves.",
    "search_terms": ["phrase 1", "phrase 2", "phrase 3", "phrase 4", "phrase 5"]
  }

  [PAGES_DATA]
  ${JSON.stringify(pagesData)}
`

  try {
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents: prompt,
    });

    const llmOutput = toLLMOutput(response.text ?? "");
    console.log(llmOutput);
    return NextResponse.json(llmOutput);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate content";
    console.error("Gemini generateContent failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
