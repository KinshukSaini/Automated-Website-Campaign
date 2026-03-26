"use client";

import { useState } from "react";

type FinalPost = {
  post_id?: string;
  subreddit?: string;
  reasoning?: string;
  reply_content?: string;
  threadUrl?: string;
  postUrl?: string;
  url?: string;
};

type ApiResult = {
  error?: string;
  finalPosts?: FinalPost[];
  [key: string]: unknown;
};

function getThreadLink(post: FinalPost): string {
  const directLink = post.threadUrl ?? post.postUrl ?? post.url;
  if (typeof directLink === "string" && directLink.trim()) {
    return directLink;
  }

  if (post.subreddit && post.post_id) {
    const cleanSubreddit = post.subreddit.replace(/^r\//i, "");
    return `https://www.reddit.com/r/${cleanSubreddit}/comments/${post.post_id}`;
  }

  return "";
}

export default function Home() {
  const [text, setText] = useState("http://");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setLoading] = useState(false);
  const [copiedPostKey, setCopiedPostKey] = useState<string>("");

  const formatSubreddit = (subreddit?: string): string => {
    if (!subreddit) return "";
    return subreddit.replace(/^r\//i, "");
  };

  const handleSubmit = async () => {
    try {
      setError("");
      setLoading(true);

      const post = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: text,
        }),
      });

      const data = (await post.json()) as ApiResult;

      if (!post.ok) {
        setResult(data);
        setError(data.error ?? `Request failed with status ${post.status}`);
        return;
      }

      setResult(data);

    } catch (error) {
      setError("Request failed. Please try again.");
      console.error("Request failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReply = async (replyText: string, postKey: string) => {
    if (!replyText.trim()) return;

    try {
      await navigator.clipboard.writeText(replyText);
      setCopiedPostKey(postKey);
      setTimeout(() => setCopiedPostKey(""), 1800);
    } catch (copyError) {
      console.error("Copy failed:", copyError);
    }
  };

  return (
    <div className="bg-gray-800 text-violet-200 min-h-screen w-full px-4 py-10 flex flex-col items-center gap-10">
      <h1 className="text-4xl text-center font-bold">Automated Website Campaign</h1>
      <div className="w-full max-w-4xl flex flex-col sm:flex-row gap-4 sm:gap-6">
        <input
          className="border-2 rounded-2xl p-4 flex-1"
          placeholder="Enter your URL here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className={isLoading
            ? "bg-violet-900/60 text-violet-300 py-2 px-4 rounded-2xl cursor-not-allowed"
            : "bg-violet-900 hover:bg-violet-800 text-violet-200 py-2 px-4 rounded-2xl"}
        >
          {isLoading ? "Submitting..." : "submit"}
        </button>
      </div>

      {error ? (
        <p className="text-red-300 bg-red-950/40 border border-red-400/30 rounded-xl p-3">{error}</p>
      ) : null}

      {result?.finalPosts && result.finalPosts.length > 0 ? (
        <section className="w-full max-w-5xl">
          <h2 className="text-2xl font-semibold mb-4">Generated Campaign Posts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {result.finalPosts.map((post, index) => {
              const threadLink = getThreadLink(post);
              const replyText = post.reply_content?.trim() ?? "";
              const postKey = `${post.post_id ?? "post"}-${index}`;

              return (
                <article
                  key={postKey}
                  className="rounded-2xl border border-violet-300/20 bg-black/20 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-semibold">Post #{index + 1}</p>
                    {post.subreddit ? (
                      <span className="text-xs rounded-full px-3 py-1 bg-violet-900/70 border border-violet-300/30">
                        r/{formatSubreddit(post.subreddit)}
                      </span>
                    ) : null}
                  </div>

                  {post.reasoning ? (
                    <div>
                      <p className="text-sm font-medium text-violet-300 mb-1">Why this thread</p>
                      <p className="text-sm leading-6">{post.reasoning}</p>
                    </div>
                  ) : null}

                  <div>
                    <p className="text-sm font-medium text-violet-300 mb-1">Reply post by us</p>
                    <p className="text-sm whitespace-pre-wrap leading-6">
                      {replyText || "No generated reply content."}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopyReply(replyText, postKey)}
                      disabled={!replyText}
                      className={replyText
                        ? "mt-3 rounded-lg border border-violet-300/40 px-3 py-1.5 text-xs hover:bg-violet-900/40"
                        : "mt-3 rounded-lg border border-violet-300/20 px-3 py-1.5 text-xs text-violet-300/50 cursor-not-allowed"}
                    >
                      {copiedPostKey === postKey ? "Copied" : "Copy reply text"}
                    </button>
                  </div>

                  {threadLink ? (
                    <a
                      href={threadLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block rounded-lg bg-violet-900 hover:bg-violet-800 px-4 py-2 text-sm font-medium"
                    >
                      Open original Reddit post
                    </a>
                  ) : (
                    <p className="text-xs text-violet-300/80">No link available for this post.</p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* {result ? (
        <pre className="max-w-5xl w-full overflow-auto rounded-xl bg-black/30 p-4 text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null} */}
    </div>
  );
}