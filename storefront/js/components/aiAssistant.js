import { getCurrentSession } from "../services/authService.js";
import { getCart, addToCart, updateCartQuantity, removeFromCart } from "../services/cartService.js";

let initialized = false;
let messages = [];
let historyLoaded = false;

function renderMessage(role, text, actions = []) {
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

async function loadConversationHistory() {
  if (historyLoaded) return;
  historyLoaded = true;
  try {
    const session = await getCurrentSession();
    const response = await fetch("/api/ai/history", {
      headers: { ...(session?.access_token ? { Authorization: "Bearer " + session.access_token } : {}) },
    });
    if (!response.ok) throw new Error("HISTORY_LOAD_FAILED");
    const data = await response.json();
    messages = Array.isArray(data.messages) ? data.messages.slice(-30).map(item => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.content || ""),
    })) : [];
    const list = document.querySelector(".beulah-ai__messages");
    if (list) list.textContent = "";
    for (const item of messages) renderMessage(item.role, item.content);
    if (!messages.length && !document.querySelector(".beulah-ai__panel")?.hidden) {
      addMessage("assistant", "I can help with products, current stock, your orders, your cart, and checkout.");
    }
  } catch {
    messages = [];
  }
}

async function clearConversation() {
  try {
    const session = await getCurrentSession();
    const response = await fetch("/api/ai/history", {
      method: "DELETE",
      headers: { ...(session?.access_token ? { Authorization: "Bearer " + session.access_token } : {}) },
    });
    if (!response.ok) throw new Error("CLEAR_FAILED");
  } catch {
    return;
  }
  messages = [];
  const list = document.querySelector(".beulah-ai__messages");
  if (list) list.textContent = "";
  addMessage("assistant", "Conversation cleared. I can help with Beulah Foods products, orders, cooking, delivery, and checkout.");
}

function injectStyles() {
  if (document.getElementById("beulah-ai-assistant-styles")) return;
  const style = document.createElement("style");
  style.id = "beulah-ai-assistant-styles";
  style.textContent = `
    .beulah-ai { position:fixed; right:18px; bottom:18px; z-index:180; font-family:inherit; }
    .beulah-ai__toggle { position:relative; width:58px; height:58px; display:grid; place-items:center; border:0; border-radius:50%; background:var(--color-accent,#c9f36a); color:var(--color-accent-ink,#18300f); box-shadow:0 12px 30px rgba(0,0,0,.18); cursor:pointer; animation:beulahAiPulse 2.2s ease-in-out infinite; }
    .beulah-ai__toggle::before { content:""; position:absolute; inset:-7px; border:2px solid rgba(201,243,106,.7); border-radius:50%; animation:beulahAiRing 2.2s ease-out infinite; pointer-events:none; }
    .beulah-ai__toggle::after { content:"Ask Beulah AI"; position:absolute; right:68px; top:50%; transform:translateY(-50%); white-space:nowrap; padding:7px 10px; border-radius:8px; background:#18300f; color:#fff; font-size:.72rem; font-weight:800; box-shadow:0 8px 24px rgba(0,0,0,.16); opacity:0; pointer-events:none; animation:beulahAiHint 5s ease-in-out 1s infinite; }
    .beulah-ai__toggle:hover::after,.beulah-ai__toggle:focus-visible::after { opacity:1; animation:none; }\n    .beulah-ai.is-open .beulah-ai__toggle, .beulah-ai.is-open .beulah-ai__toggle::before, .beulah-ai.is-open .beulah-ai__toggle::after { animation:none; }\n    .beulah-ai.is-open .beulah-ai__toggle::before, .beulah-ai.is-open .beulah-ai__toggle::after { opacity:0; }\n    .beulah-ai__toggle-icon { width:25px; height:25px; display:block; }\n    .beulah-ai__toggle-icon path { vector-effect:non-scaling-stroke; }
    .beulah-ai__panel { position:absolute; right:0; bottom:72px; width:min(380px,calc(100vw - 28px)); height:min(600px,calc(100vh - 110px)); display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--color-border,#dce4dc); border-radius:18px; background:var(--color-surface,#fff); box-shadow:0 24px 70px rgba(0,0,0,.18); }
    .beulah-ai__panel[hidden] { display:none; }
    .beulah-ai__head { display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid var(--color-border,#dce4dc); background:#18300f; color:#fff; }
    .beulah-ai__head strong { display:block; font-size:.95rem; }
    .beulah-ai__head span { display:block; margin-top:2px; color:rgba(255,255,255,.7); font-size:.74rem; }
    .beulah-ai__clear { margin-left:auto; margin-right:8px; border:1px solid rgba(255,255,255,.25); border-radius:7px; padding:5px 8px; background:transparent; color:#fff; font-size:.68rem; cursor:pointer; }
    .beulah-ai__close { border:0; background:transparent; color:#fff; font-size:1.2rem; cursor:pointer; }
    .beulah-ai__notice { padding:7px 12px; border-bottom:1px solid var(--color-border,#dce4dc); background:#f5f8f2; color:#667262; font-size:.68rem; line-height:1.35; text-align:center; }
    .beulah-ai__messages { flex:1; overflow:auto; padding:14px; display:grid; align-content:start; gap:10px; background:#f7f9f5; }
    .beulah-ai__msg { max-width:88%; padding:10px 12px; border-radius:13px; font-size:.86rem; line-height:1.5; white-space:pre-wrap; }
    .beulah-ai__msg--user { margin-left:auto; background:#18300f; color:#fff; border-bottom-right-radius:4px; animation:beulahAiMessageIn .18s ease-out; }
    .beulah-ai__msg--assistant { background:#fff; color:#263026; border:1px solid #e0e7df; border-bottom-left-radius:4px; animation:beulahAiMessageIn .2s ease-out; }
    .beulah-ai__actions { margin-top:7px; display:flex; flex-wrap:wrap; gap:7px; }
    .beulah-ai__action { display:inline-flex; align-items:center; padding:7px 9px; border:1px solid #d7e1d4; border-radius:9px; background:#fff; color:#315222; font-size:.76rem; font-weight:700; text-decoration:none; }
    .beulah-ai__thinking { display:flex; align-items:center; gap:7px; width:max-content; padding:10px 13px; border:1px solid #e0e7df; border-radius:13px; border-bottom-left-radius:4px; background:#fff; color:#5b6958; font-size:.78rem; animation:beulahAiMessageIn .2s ease-out; }
    .beulah-ai__thinking-label { font-weight:700; }
    .beulah-ai__thinking-dots { display:flex; gap:3px; }
    .beulah-ai__thinking-dots i { width:5px; height:5px; border-radius:50%; background:currentColor; animation:beulahAiDot 1.2s ease-in-out infinite; }
    .beulah-ai__thinking-dots i:nth-child(2) { animation-delay:.15s; }
    .beulah-ai__thinking-dots i:nth-child(3) { animation-delay:.3s; }
    .beulah-ai__form { display:flex; gap:8px; padding:10px; border-top:1px solid var(--color-border,#dce4dc); background:#fff; }
    .beulah-ai__input { min-width:0; flex:1; resize:none; min-height:42px; max-height:100px; padding:10px 11px; border:1px solid #ccd7cb; border-radius:10px; font:inherit; font-size:.86rem; outline:none; }
    .beulah-ai__input:focus { border-color:#7e9b70; box-shadow:0 0 0 3px rgba(126,155,112,.12); }
    .beulah-ai__send { align-self:flex-end; min-width:72px; height:42px; border:0; border-radius:10px; background:#18300f; color:#fff; font-weight:700; cursor:pointer; }
    .beulah-ai__send:disabled { opacity:.7; cursor:wait; }
    @keyframes beulahAiPulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.07); } }
    @keyframes beulahAiRing { 0% { transform:scale(.88); opacity:.9; } 70%,100% { transform:scale(1.22); opacity:0; } }
    @keyframes beulahAiHint { 0%,20%,100% { opacity:0; transform:translateY(-50%) translateX(5px); } 5%,16% { opacity:1; transform:translateY(-50%) translateX(0); } }
    @keyframes beulahAiMessageIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:none; } }
    @keyframes beulahAiDot { 0%,60%,100% { transform:translateY(0); opacity:.35; } 30% { transform:translateY(-4px); opacity:1; } }
    @media(prefers-reduced-motion:reduce) { .beulah-ai__toggle,.beulah-ai__toggle::before,.beulah-ai__toggle::after,.beulah-ai__msg,.beulah-ai__thinking,.beulah-ai__thinking-dots i { animation:none; } }
    @media(max-width:520px){ .beulah-ai { right:12px; bottom:12px; } .beulah-ai__panel { right:-2px; bottom:68px; width:calc(100vw - 24px); height:min(620px,calc(100vh - 92px)); } .beulah-ai__toggle::after { right:66px; } }
  `;
  document.head.append(style);
}

function addMessage(role, text, actions = []) {
  messages.push({ role, content: text });
  renderMessage(role, text, actions);
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

  const list = document.querySelector(".beulah-ai__messages");
  const thinking = document.createElement("div");
  thinking.className = "beulah-ai__thinking";
  thinking.setAttribute("role", "status");
  thinking.setAttribute("aria-label", "Beulah Assistant is thinking");
  thinking.innerHTML = '<span class="beulah-ai__thinking-label">Thinking</span><span class="beulah-ai__thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
  list?.append(thinking);
  if (list) list.scrollTop = list.scrollHeight;

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
        cart: getCart(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data?.error === "AI_HISTORY_DB_NOT_CONFIGURED") throw new Error("AI_HISTORY_DB_NOT_CONFIGURED");
      throw new Error(data?.error || "ASSISTANT_REQUEST_FAILED");
    }
    applyActions(data.actions);
    thinking.remove();
    addMessage("assistant", data.message || "I could not produce a response.", data.actions || []);
  } catch (error) {
    thinking.remove();
    addMessage("assistant", error?.message === "AUTHENTICATION_REQUIRED"
      ? "Please log in to use that customer-account action."
      : "I’m unable to complete that request right now. Please try again.");
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
        <div><strong>Beulah AI Assistant</strong><span>Beulah Foods customer assistant</span></div>
        <button class="beulah-ai__clear" type="button" aria-label="Clear conversation">Clear</button>
        <button class="beulah-ai__close" type="button" aria-label="Close assistant">×</button>
      </header>
      <div class="beulah-ai__notice">Beulah AI can make mistakes. For important information, please confirm with Beulah Foods.</div>
      <div class="beulah-ai__messages" aria-live="polite"></div>
      <form class="beulah-ai__form">
        <textarea class="beulah-ai__input" rows="1" maxlength="2000" placeholder="Ask about Beulah Foods…"></textarea>
        <button class="beulah-ai__send" type="submit">Send</button>
      </form>
    </section>
    <button class="beulah-ai__toggle" type="button" aria-label="Ask Beulah AI" aria-expanded="false"><svg class="beulah-ai__toggle-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-3.5 2V11.5A7.5 7.5 0 0 1 11 4h1.5A7.5 7.5 0 0 1 20 11.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button>
  `;
  document.body.append(root);

  const panel = root.querySelector(".beulah-ai__panel");
  const toggle = root.querySelector(".beulah-ai__toggle");
  const close = root.querySelector(".beulah-ai__close");
  const clear = root.querySelector(".beulah-ai__clear");
  const form = root.querySelector(".beulah-ai__form");
  const input = root.querySelector(".beulah-ai__input");
  const send = root.querySelector(".beulah-ai__send");

  toggle.addEventListener("click", () => {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    if (!messages.length && historyLoaded) addMessage("assistant", "I can help with products, current stock, your orders, your cart, and checkout.");
    input.focus();
  });
  clear.addEventListener("click", clearConversation);
  loadConversationHistory();

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
