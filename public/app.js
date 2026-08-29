// DK-AI frontend logic
// Talks to our own backend (server.js), which talks to Gemini + Tavily.

const chatWindow = document.getElementById("chatWindow");
const composer = document.getElementById("composer");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const modeButtons = document.querySelectorAll(".mode-btn");

let mode = "chat"; // "chat" or "search"
let history = []; // { role: "user" | "assistant", text: "" }

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    mode = btn.dataset.mode;
    userInput.placeholder =
      mode === "search" ? "Search the web..." : "Message DK-AI...";
  });
});

// auto-grow textarea
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
});

// send on Enter (Shift+Enter for newline)
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    composer.requestSubmit();
  }
});

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  userInput.value = "";
  userInput.style.height = "auto";
  sendBtn.disabled = true;

  const typingEl = addTyping();

  try {
    if (mode === "search") {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      const data = await res.json();
      typingEl.remove();
      if (data.error) {
        addMessage("bot", "⚠️ " + data.error);
      } else {
        addMessage("bot", data.answer, data.sources);
      }
    } else {
      history.push({ role: "user", text });
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      typingEl.remove();
      if (data.error) {
        addMessage("bot", "⚠️ " + data.error);
      } else {
        addMessage("bot", data.reply);
        history.push({ role: "assistant", text: data.reply });
      }
    }
  } catch (err) {
    typingEl.remove();
    addMessage("bot", "⚠️ Could not reach the server: " + err.message);
  }

  sendBtn.disabled = false;
});

function addMessage(role, text, sources) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + (role === "user" ? "user" : "bot");

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = marked.parse(text);

  if (sources && sources.length) {
    const srcDiv = document.createElement("div");
    srcDiv.className = "sources";
    srcDiv.innerHTML =
      "Sources:" +
      sources
        .map((s, i) => `<a href="${s.url}" target="_blank">[${i + 1}] ${s.title}</a>`)
        .join("");
    bubble.appendChild(srcDiv);
  }

  wrap.appendChild(bubble);
  chatWindow.appendChild(wrap);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  bubble.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
  return wrap;
}

function addTyping() {
  const wrap = document.createElement("div");
  wrap.className = "msg bot";
  wrap.innerHTML = `<div class="bubble typing">DK-AI is thinking...</div>`;
  chatWindow.appendChild(wrap);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return wrap;
}
