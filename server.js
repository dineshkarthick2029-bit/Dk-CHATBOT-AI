// DK-AI backend server
// This file receives requests from the website (public/app.js)
// and forwards them to Google Gemini (for chat/code) and Tavily (for search).
// Your API keys stay safely on the server and are never shown to website visitors.

const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_MODEL = "gemini-3.6-flash"; // free-tier model
const GROQ_MODEL = "openai/gpt-oss-120b"; // free Groq model (replaces deprecated llama-3.3-70b-versatile)

// ---------- CHAT + CODE endpoint (ChatGPT / Claude / Copilot style) ----------
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, model } = req.body; // model: "gemini" or "groq"

    if (model === "groq") {
      return handleGroqChat(messages, res);
    }
    return handleGeminiChat(messages, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

async function handleGeminiChat(messages, res) {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "Missing GEMINI_API_KEY on server. Add it in your .env file." });
  }

  // Convert our simple message format into Gemini's expected format
  const contents = messages.map((m) => {
    const parts = [{ text: m.text }];
    if (m.image && m.image.data && m.image.mimeType) {
      parts.push({ inlineData: { mimeType: m.image.mimeType, data: m.image.data } });
    }
    return {
      role: m.role === "assistant" ? "model" : "user",
      parts,
    };
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [
            {
              text:
                "You are DK-AI, a helpful assistant made by DK. When asked to write code, use proper markdown code blocks with the language name (like ```python). Be clear and concise.",
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error("Gemini error:", errData);
    return res.status(500).json({ error: errData.error?.message || "Gemini API error" });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const piece = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
        if (piece) res.write(piece);
      } catch (e) {
        // ignore partial/unparseable chunks
      }
    }
  }

  res.end();
}

async function handleGroqChat(messages, res) {
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: "Missing GROQ_API_KEY on server. Add it in your .env file." });
  }

  // Convert to Groq's OpenAI-style format (text only, no images)
  const groqMessages = [
    {
      role: "system",
      content:
        "You are DK-AI, a helpful assistant made by DK. When asked to write code, use proper markdown code blocks with the language name (like ```python). Be clear and concise.",
    },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text,
    })),
  ];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: groqMessages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error("Groq error:", errData);
    return res.status(500).json({ error: errData.error?.message || "Groq API error" });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const piece = parsed.choices?.[0]?.delta?.content || "";
        if (piece) res.write(piece);
      } catch (e) {
        // ignore partial/unparseable chunks
      }
    }
  }

  res.end();
}

// ---------- SEARCH endpoint (Perplexity style: web search + AI summary) ----------
app.post("/api/search", async (req, res) => {
  try {
    const { query } = req.body;

    if (!TAVILY_API_KEY) {
      return res.status(500).json({ error: "Missing TAVILY_API_KEY on server. Add it in your .env file." });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY on server. Add it in your .env file." });
    }

    // Step 1: search the live web with Tavily
    const searchResp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        max_results: 5,
        include_answer: false,
      }),
    });
    const searchData = await searchResp.json();

    if (!searchResp.ok) {
      console.error("Tavily error:", searchData);
      return res.status(500).json({ error: searchData.error || "Search API error" });
    }

    const sources = searchData.results || [];
    const context = sources
      .map((s, i) => `[${i + 1}] ${s.title}\n${s.content}\nURL: ${s.url}`)
      .join("\n\n");

    // Step 2: ask Gemini to write an answer grounded in those search results
    const prompt = `Using ONLY the web search results below, answer the user's question. Cite sources using [1], [2] etc. matching the numbers below. If the results don't contain the answer, say so.\n\nQuestion: ${query}\n\nSearch results:\n${context}`;

    const aiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      }
    );
    const aiData = await aiResp.json();
    const answer =
      aiData.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      "Sorry, I could not generate an answer.";

    res.json({
      answer,
      sources: sources.map((s) => ({ title: s.title, url: s.url })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DK-AI server running at http://localhost:${PORT}`);
});
