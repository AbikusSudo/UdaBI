import Client from "https://g4f.dev/dist/js/client.js";

const client = new Client();
const chatBox = document.getElementById("chat-box");
const promptInput = document.getElementById("prompt");
const sendBtn = document.getElementById("send");
const redirectBtn = document.getElementById("redirect");
const statusEl = document.getElementById("status");

async function checkServer() {
  try {
    const res = await fetch("https://udabi.ddns.net/api/health", { cache: "no-store" });
    if (res.ok) {
      statusEl.textContent = "Good news, server alivable ✅";
      redirectBtn.disabled = false;
    } else throw new Error();
  } catch {
    statusEl.textContent = "Unable to access server ❌";
    redirectBtn.disabled = true;
  }
}

redirectBtn.onclick = () => {
  window.location.href = "https://udabi.ddns.net/";
};

function addMessage(role, text, isImage = false) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  if (isImage) {
    const img = new Image();
    img.src = text;
    img.style.maxWidth = "100%";
    div.appendChild(img);
  } else {
    div.textContent = `${role === "user" ? "You" : "UdaBI"}: ${text}`;
  }
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

sendBtn.onclick = async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) return;
  addMessage("user", prompt);
  promptInput.value = "";

  try {
    const isImage = /draw|generate|image|photo|picture|art/i.test(prompt);
    let response;

    if (isImage) {
      response = await client.images.generate({
        model: "flux",
        prompt
      });
      addMessage("ai", response.data[0].url, true);
    } else {
      response = await client.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: "You are UdaBI — an advanced AI made by AbikusSudo™." },
          { role: "user", content: prompt }
        ]
      });
      const content = response.choices[0].message.content;
      addMessage("ai", content);
    }
  } catch (err) {
    console.error(err);
    addMessage("ai", "Error: " + err.message);
  }
};
checkServer();
