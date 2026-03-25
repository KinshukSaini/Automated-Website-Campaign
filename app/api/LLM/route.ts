import {GoogleGenAI} from '@google/genai';
import {NextRequest, NextResponse} from 'next/server';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});

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

export async function POST(request: NextRequest) {
  const { pagesData } = await request.json();

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

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: prompt,
  });

  const terms = toSearchTerms(response.text ?? "");

  console.log(terms);
  return NextResponse.json(terms);
}
