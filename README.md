# ThreadScout

AI-assisted Reddit outreach copilot for turning a website into contextual, ready-to-post Reddit replies.

## What This Project Is

This app helps you promote a website in a non-spammy, contextual way:

1. Crawl a target website.
2. Use an LLM to summarize what the website offers and generate search terms.
3. Search Reddit for relevant threads.
4. Use an LLM to draft tailored replies for matching threads.
5. Show reply drafts, reasoning, and direct links to the original Reddit posts.

It is not a fully automated posting bot. It is a human-in-the-loop outreach assistant.

## Naming Recommendation

Your old name, "Automated Website Campaign," sounds broad and marketing-heavy. This product is more specific: it scouts Reddit opportunities and drafts replies.

Recommended name: ThreadScout

Other good options:

- ReplyScout
- RedditReply Copilot
- ContextReply
- ThreadMatch AI

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Tailwind CSS
- Google GenAI SDK
- Cheerio (for crawling/parsing website content)

## Project Flow

Main orchestration route: app/api/route.ts

1. Validate URL input.
2. Fetch website crawl data from app/api/crawl/route.ts.
3. Get website description + search terms from app/api/LLM/route.ts.
4. Search Reddit via app/api/reddit-search/route.ts.
5. Generate draft replies via app/api/GenLLM/route.ts.
6. Enrich generated replies with thread URL by matching post_id to Reddit search results.
7. Return finalPosts to the UI.

## UI Features

Homepage: app/page.tsx

- URL input + submit action
- Generated campaign cards
- Reasoning for each suggested target
- Draft reply text
- Open original Reddit post button
- Copy reply text button

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create .env.local in the project root and add:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

3. Start dev server:

```bash
npm run dev
```

4. Open http://localhost:3000

## Scripts

- npm run dev
- npm run build
- npm run start
- npm run lint

## Notes

- Keep generated replies human-reviewed before posting.
- Reddit rate limits and quality filters still apply.
- Best results come from clear website content and specific niches.
