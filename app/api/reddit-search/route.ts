// import { NextRequest, NextResponse } from "next/server";

// export async function POST(request : NextRequest) {
//   const { keyword } = await request.json();
//   const url = `https://www.reddit.com/search.json?q=${keyword}&sort=new&limit=5`;
  
//   const response = await fetch(url, {
//     headers: {
//       // Always use a unique User-Agent so you don't get 429'd
//       'User-Agent': 'web:black-letter-scout:v1.0 (by /u/YOUR_USERNAME)'
//     }
//   });

//   const data = await response.json();
  
//   // Reddit's JSON structure is nested: data -> children -> data
//   return data.data.children.map(post => ({
//     title: post.data.title,
//     url: post.data.url,
//     text: post.data.selftext,
//     id: post.data.id
//   }));
// }