// DK-AI backend server
// This file receives requests from the website (public/app.js)
// and forwards them to Google Gemini (for chat/code) and Tavily (for search).
// Your API keys stay safely on the server and are never shown to website visitors.

const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash"; // free-tier model

// ---------- CHAT + CODE endpoint (ChatGPT / Claude / Copilot style) ----------
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body; // [{role: "user"/"model", text: "..."}]

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing GEMINI_API_KEY on server. Add it in your .env file." });
    }

    // Convert our simple message format into Gemini's expected format
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);
      return res.status(500).json({ error: data.error?.message || "Gemini API error" });
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      "Sorry, I could not generate a reply.";

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error: " + err.message });
  }
});

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
