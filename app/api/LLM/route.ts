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

  const prompt = `
    [ROLE] Extract the relevant search terms from the following page data. Focus on keywords, topics, and themes that would help in searching on reddit for content that the website might be useful for. Provide the top 5 search terms in an array string format. If you can't find relevant search terms, return an empty array.
    
    [IMPORTANT] give the top 5 search terms in array string format: 
    ["terms1", "terms2, ..."] 
    
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
