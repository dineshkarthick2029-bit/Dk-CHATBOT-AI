// DK-AI frontend logic
// Talks to our own backend (server.js), which talks to Gemini + Tavily.

const chatWindow = document.getElementById("chatWindow");
const composer = document.getElementById("composer");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const modeButtons = document.querySelectorAll(".mode-btn");
const modelSelect = document.getElementById("modelSelect");
const attachBtn = document.getElementById("attachBtn");
const imageInput = document.getElementById("imageInput");
const imagePreviewBar = document.getElementById("imagePreviewBar");
const imagePreviewThumb = document.getElementById("imagePreviewThumb");
const removeImageBtn = document.getElementById("removeImageBtn");

let mode = "chat"; // "chat" or "search"
let history = []; // { role: "user" | "assistant", text: "", image?: {mimeType, data} }
let attachedImage = null; // { mimeType, data, previewUrl }

attachBtn.addEventListener("click", () => imageInput.click());

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result; // "data:image/png;base64,AAAA..."
    const base64 = dataUrl.split(",")[1];
    attachedImage = { mimeType: file.type, data: base64, previewUrl: dataUrl };
    imagePreviewThumb.src = dataUrl;
    imagePreviewBar.style.display = "flex";
  };
  reader.readAsDataURL(file);
  imageInput.value = ""; // allow picking the same file again later
});

removeImageBtn.addEventListener("click", () => {
  attachedImage = null;
  imagePreviewBar.style.display = "none";
});


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
  if (!text && !attachedImage) return;

  const imageForThisMessage = attachedImage;
  addMessage("user", text || "(photo)", null, imageForThisMessage?.previewUrl);
  userInput.value = "";
  userInput.style.height = "auto";
  attachedImage = null;
  imagePreviewBar.style.display = "none";
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
      const selectedModel = modelSelect.value;

      if (imageForThisMessage && selectedModel === "groq") {
        addMessage("bot", "⚠️ Photos only work with Gemini Flash. Switch the model dropdown to Gemini and resend.");
        typingEl.remove();
        sendBtn.disabled = false;
        return;
      }

      const userMsg = { role: "user", text: text || "Describe this photo." };
      if (imageForThisMessage) {
        userMsg.image = { mimeType: imageForThisMessage.mimeType, data: imageForThisMessage.data };
      }
      history.push(userMsg);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, model: selectedModel }),
      });

      typingEl.remove();

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        addMessage("bot", "⚠️ " + (errData.error || "Something went wrong."));
      } else {
        const botWrap = addMessage("bot", "");
        const textDiv = botWrap.querySelector(".bot-text");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          textDiv.textContent = fullText; // plain text while streaming, fast to update
          chatWindow.scrollTop = chatWindow.scrollHeight;
        }

        // once streaming is done, render proper markdown + code highlighting
        textDiv.innerHTML = marked.parse(fullText || "Sorry, I could not generate a reply.");
        textDiv.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
        chatWindow.scrollTop = chatWindow.scrollHeight;

        history.push({ role: "assistant", text: fullText });
      }
    }
  } catch (err) {
    typingEl.remove();
    addMessage("bot", "⚠️ Could not reach the server: " + err.message);
  }

  sendBtn.disabled = false;
});

function addMessage(role, text, sources, imageUrl) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + (role === "user" ? "user" : "bot");

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.className = "chat-image";
    bubble.appendChild(img);
  }

  const textDiv = document.createElement("div");
  textDiv.className = "bot-text";
  if (text) textDiv.innerHTML = marked.parse(text);
  bubble.appendChild(textDiv);

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
