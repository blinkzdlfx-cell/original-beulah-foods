import { getCurrentSession } from "../services/authService.js";
import { getCart, addToCart, updateCartQuantity, removeFromCart } from "../services/cartService.js";

let initialized = false;
let messages = [];

function injectStyles() {
  if (document.getElementById("beulah-ai-assistant-styles")) return;
  const style = document.createElement("style");
  style.id = "beulah-ai-assistant-styles";
  style.textContent = `
    .beulah-ai { position:fixed; right:18px; bottom:18px; z-index:180; font-family:inherit; }
    .beulah-ai__toggle { width:54px; height:54px; border:0; border-radius:50%; background:var(--color-accent,#c9f36a); color:var(--color-accent-ink,#18300f); box-shadow:0 12px 30px rgba(0,0,0,.18); font-weight:800; cursor:pointer; }
    .beulah-ai__panel { position:absolute; right:0; bottom:66px; width:min(380px,calc(100vw - 28px)); height:min(600px,calc(100vh - 110px)); display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--color-border,#dce4dc); border-radius:18px; background:var(--color-surface,#fff); box-shadow:0 24px 70px rgba(0,0,0,.18); }
    .beulah-ai__panel[hidden] { display:none; }
    .beulah-ai__head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid var(--color-border,#dce4dc); background:#18300f; color:#fff; }
    .beulah-ai__head strong { display:block; font-size:.95rem; }
    .beulah-ai__head span { display:block; margin-top:2px; color:rgba(255,255,255,.7); font-size:.74rem; }
    .beulah-ai__close { border:0; background:transparent; color:#fff; font-size:1.2rem; cursor:pointer; }
    .beulah-ai__messages { flex:1; overflow:auto; padding:14px; display:grid; align-content:start; gap:10px; background:#f7f9f5; }
    .beulah-ai__msg { max-width:88%; padding:10px 12px; border-radius:13px; font-size:.86rem; line-height:1.5; white-space:pre-wrap; }
    .beulah-ai__msg--user { margin-left:auto; background:#18300f; color:#fff; border-bottom-right-radius:4px; }
    .beulah-ai__msg--assistant { background:#fff; color:#263026; border:1px solid #e0e7df; border-bottom-left-radius:4px; }
    .beulah-ai__actions { margin-top:7px; display:flex; flex-wrap:wrap; gap:7px; }
    .beulah-ai__action { display:inline-flex; align-items:center; padding:7px 9px; border:1px solid #d7e1d4; border-radius:9px; background:#fff; color:#315222; font-size:.76rem; font-weight:700; text-decoration:none; }
    .beulah-ai__form { display:flex; gap:8px; padding:10px; border-top:1px solid var(--color-border,#dce4dc); background:#fff; }
    .beulah-ai__input { min-width:0; flex:1; resize:none; min-height:42px; max-height:100px; padding:10px 11px; border:1px solid #ccd7cb; border-radius:10px; font:inherit; font-size:.86rem; outline:none; }
    .beulah-ai__input:focus { border-color:#7e9b70; box-shadow:0 0 0 3px rgba(126,155,112,.12); }
    .beulah-ai__send { align-self:flex-end; min-width:72px; height:42px; border:0; border-radius:10px; background:#18300f; color:#fff; font-weight:700; cursor:pointer; }
    .beulah-ai__send:disabled { opacity:.55; cursor:wait; }
    @media(max-width:520px){ .beulah-ai { right:12px; bottom:12px; } .beulah-ai__panel { right:-2px; bottom:64px; width:calc(100vw - 24px); height:min(620px,calc(100vh - 92px)); } }
  `;
  document.head.append(style);
}

function addMessage(role, text, actions = []) {
  messages.push({ role, content: text });
  const list = document.querySelector(".beulah-ai__messages");
  if (!list) return;
  const bubble = document.createElement("div");
  bubble.className = "beulah-ai__msg " + (role === "user" ? "beulah-ai__msg--user" : "beulah-ai__msg--assistant");
  bubble.textContent = text;
  if (actions.length) {
    const actionWrap = document.createElement("div");
    actionWrap.className = "beulah-ai__actions";
    for (const action of actions) {
      if (action.type === "order_created" && action.checkout_url) {
        const link = document.createElement("a");
        link.className = "beulah-ai__action";
        link.href = action.checkout_url;
        link.textContent = "Continue to checkout";
        actionWrap.append(link);
      }
    }
    if (actionWrap.children.length) bubble.append(actionWrap);
  }
  list.append(bubble);
  list.scrollTop = list.scrollHeight;
}

function applyActions(actions) {
  for (const action of actions || []) {
    if (action.type !== "cart") continue;
    if (action.operation === "add") addToCart(action.product_id, action.quantity);
    else if (action.operation === "set") updateCartQuantity(action.product_id, action.quantity);
    else if (action.operation === "remove") removeFromCart(action.product_id);
  }
}

async function sendMessage(input, sendButton) {
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  addMessage("user", text);
  sendButton.disabled = true;
  sendButton.textContent = "…";

  try {
    const session = await getCurrentSession();
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: "Bearer " + session.access_token } : {}),
      },
      body: JSON.stringify({
        message: text,
        history: messages.slice(-12),
        cart: getCart(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "ASSISTANT_REQUEST_FAILED");
    applyActions(data.actions);
    addMessage("assistant", data.message || "I could not produce a response.", data.actions || []);
  } catch (error) {
    addMessage("assistant", error?.message === "AUTHENTICATION_REQUIRED"
      ? "Please log in to use that customer-account action."
      : "The assistant is temporarily unavailable. Please try again.");
  } finally {
    sendButton.disabled = false;
    sendButton.textContent = "Send";
    input.focus();
  }
}

export function initAiAssistant() {
  if (initialized || document.querySelector(".admin-page")) return;
  initialized = true;
  injectStyles();

  const root = document.createElement("div");
  root.className = "beulah-ai";
  root.innerHTML = `
    <section class="beulah-ai__panel" hidden aria-label="Beulah Foods AI assistant">
      <header class="beulah-ai__head">
        <div><strong>Beulah Assistant</strong><span>Products, orders and checkout help</span></div>
        <button class="beulah-ai__close" type="button" aria-label="Close assistant">×</button>
      </header>
      <div class="beulah-ai__messages" aria-live="polite"></div>
      <form class="beulah-ai__form">
        <textarea class="beulah-ai__input" rows="1" maxlength="2000" placeholder="Ask about products, stock or your order…"></textarea>
        <button class="beulah-ai__send" type="submit">Send</button>
      </form>
    </section>
    <button class="beulah-ai__toggle" type="button" aria-label="Open Beulah Assistant" aria-expanded="false">AI</button>
  `;
  document.body.append(root);

  const panel = root.querySelector(".beulah-ai__panel");
  const toggle = root.querySelector(".beulah-ai__toggle");
  const close = root.querySelector(".beulah-ai__close");
  const form = root.querySelector(".beulah-ai__form");
  const input = root.querySelector(".beulah-ai__input");
  const send = root.querySelector(".beulah-ai__send");

  toggle.addEventListener("click", () => {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    if (!messages.length) addMessage("assistant", "I can help with products, current stock, your orders, your cart, and checkout.");
    input.focus();
  });
  close.addEventListener("click", () => {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage(input, send);
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input, send);
    }
  });
}
