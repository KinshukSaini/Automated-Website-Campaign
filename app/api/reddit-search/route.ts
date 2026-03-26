import { NextRequest, NextResponse } from "next/server";

type RedditPostData = {
  id: string;
  title: string;
  selftext: string;
  subreddit_name_prefixed: string;
  permalink: string;
  is_self: boolean;
};

type RedditSearchResponse = {
  data: {
    children: Array<{
      data: RedditPostData;
    }>;
  };
};

export async function POST(request : NextRequest) {
const { keywords } = await request.json();

// 1. Remove quotes around the phrases
// 2. Wrap each phrase in parentheses to group the terms
// 3. Join with ' OR '
const query = keywords
  .map((p : string) => `(${p})`) 
  .join(' OR ');

const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=new&limit=5`;
  
  console.log("The final URL : ", url);

  const result = await fetch(url, {
    headers: {
      // Always use a unique User-Agent so you don't get 429'd
      'User-Agent': 'my-app/app/api/reddit-search my-app/app/api/reddit-search/route.ts by /u/quieteGaze'
    }
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "Failed to fetch Reddit posts" },
      { status: result.status }
    );
  }

  const json = (await result.json()) as RedditSearchResponse;

    const postsForAI = json.data.children.map((child) => {
        const post = child.data;

        return {
            id: post.id,
            title: post.title,
            text: post.selftext,
            subreddit: post.subreddit_name_prefixed,
            // This is the direct link to the thread for your browser
            threadUrl: `https://www.reddit.com${post.permalink}`,
            // This tells you if the post is actually just a link to another site
            isExternal: post.is_self === false 
        };
    });

  return NextResponse.json(postsForAI);

}