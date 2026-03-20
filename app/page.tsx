"use client";

import { useState } from "react";

export default function Home() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string>("");

  const handleSubmit = async () => {
    try {
      setError("");

      const post = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: text,
        }),
      });

      const data = (await post.json()) as { error?: string };

      if (!post.ok) {
        setResult(data);
        setError(data.error ?? `Request failed with status ${post.status}`);
        return;
      }

      setResult(data);
      console.log(data);
    } catch (error) {
      setError("Request failed. Please try again.");
      console.error("Request failed:", error);
    }
  };

  return (
    <div className="bg-gray-800 text-violet-200 min-h-screen w-full flex flex-col items-center justify-center gap-12">
      <h1 className="text-4xl font-bold">Automated Website Campaign</h1>
      <div className="flex flex-row gap-8">
        <input
          className="border-2 rounded-2xl p-4"
          placeholder="Enter your URL here..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={handleSubmit}
          className="bg-violet-900 hover:bg-violet-800 text-violet-200 py-2 px-4 rounded-2xl"
        >
          submit
        </button>
      </div>

      {error ? (
        <p className="text-red-300 bg-red-950/40 border border-red-400/30 rounded-xl p-3">{error}</p>
      ) : null}

      {result ? (
        <pre className="max-w-3xl w-full overflow-auto rounded-xl bg-black/30 p-4 text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}