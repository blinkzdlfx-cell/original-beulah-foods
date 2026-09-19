import { getCurrentSession } from "../services/authService.js";
import { initAiSlashCommands } from "./aiSlashCommands.js?v=slash-3";
import { getCart, addToCart, updateCartQuantity, removeFromCart } from "../services/cartService.js";

let initialized = false;
let messages = [];
let historyMessages = [];
let historyLoaded = false;
let conversationStarted = false;
let pendingRetry = null;

const AI_OPEN_STATE_KEY = "beulah_ai_open";

const CSS_HREF = "/storefront/css/ai-assistant.css";

const AI_COMMAND_HINTS = Object.freeze([
  "/add · add a product",
  "/remove · remove a product",
  "/products · check products",
  "/cart · review cart",
  "/reserve · reserve items",
  "/cancel · cancel reservation",
  "/help · help & contact",
]);

const NAVIGATION_TARGETS = Object.freeze({
  cart: "/cart.html", checkout: "/checkout.html", orders: "/orders.html", account: "/account.html", shop: "/shop.html", how_to: "/how-to.html",
});

function ensureStylesheet() {
  if (document.querySelector('link[data-beulah-ai-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = CSS_HREF + "?v=ai-3";
  link.dataset.beulahAiStyles = "true";
  document.head.append(link);
}

function icon(name) {
  const icons = {
    bot: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="4" stroke="currentColor" stroke-width="1.8"/><path d="M9 7V5a3 3 0 0 1 6 0v2M8.5 13h.01M15.5 13h.01M9 16c1.8 1.2 4.2 1.2 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M12 2v2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 3 10.5 13.5M21 3l-6.7 18-3.8-7.5L3 9.7 21 3Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.7"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  return icons[name] || "";
}

function getList() {
  return document.querySelector(".beulah-ai__messages");
}

function getDistanceFromBottom() {
  const list = getList();
  if (!list) return 0;
  return list.scrollHeight - list.scrollTop - list.clientHeight;
}

function isNearBottom(threshold = 72) {
  return getDistanceFromBottom() <= threshold;
}

function getWelcomeMessage() {
  const hour = new Date().getHours();
  const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const messagesByPeriod = {
    morning: [
      "Good morning. Ready when you are.",
      "Good morning. How can I help today?",
      "Good morning. What can I help you find?",
    ],
    afternoon: [
      "Good afternoon. Ready when you are.",
      "Good afternoon. What can I help you with?",
      "Good afternoon. Tell me what you need.",
    ],
    evening: [
      "Good evening. Ready when you are.",
      "Good evening. How can I help?",
      "Good evening. What are you looking for?",
    ],
  };
  const general = [
    "Ready when you are.",
    "I'm here when you're ready.",
    "What can I help you find?",
    "Let's get started.",
    "Tell me what you need.",
    "What are you looking for today?",
  ];
  const pool = [...messagesByPeriod[period], ...general];
  return pool[Math.floor(Math.random() * pool.length)];
}

function updateScrollButton() {
  const root = document.querySelector(".beulah-ai");
  const button = root?.querySelector(".beulah-ai__scroll-down");
  if (!button) return;
  button.classList.toggle("is-visible", getDistanceFromBottom() > 72);
}

function scrollToLatest({ smooth = true, force = false } = {}) {
  const list = getList();
  if (!list) return;
  if (!force && !isNearBottom()) return;

  const latest = list.querySelector(".beulah-ai__message:last-of-type");
  if (latest) {
    const targetTop = Math.max(
      0,
      latest.offsetTop - Math.max(0, (list.clientHeight - latest.offsetHeight) / 2),
    );
    list.scrollTo({
      top: targetTop,
      behavior: smooth ? "smooth" : "auto",
    });
  } else {
    list.scrollTo({
      top: list.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  requestAnimationFrame(updateScrollButton);
}

function scrollToTurn(element, behavior = "smooth") {
  if (!element) return;
  const list = getList();
  if (!list) return;

  const targetTop = Math.max(
    0,
    element.offsetTop - Math.max(0, (list.clientHeight - element.offsetHeight) / 2),
  );

  list.scrollTo({
    top: targetTop,
    behavior,
  });
  requestAnimationFrame(updateScrollButton);
}

function createMessageElement(message, { animate = true } = {}) {
  const article = document.createElement("article");
  article.className = "beulah-ai__message " +
    (message.role === "user" ? "beulah-ai__message--user" : "beulah-ai__message--assistant");
  article.dataset.messageId = message.id;

  if (!animate) article.style.animation = "none";

  if (message.role === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "beulah-ai__message-avatar";
    avatar.innerHTML = icon("bot");
    avatar.setAttribute("aria-hidden", "true");
    article.append(avatar);
  }

  const body = document.createElement("div");
  body.className = "beulah-ai__message-body";

  const meta = document.createElement("div");
  meta.className = "beulah-ai__message-meta";
  meta.textContent = message.role === "user" ? "You" : "Beulah AI";
  body.append(meta);

  const bubble = document.createElement("div");
  bubble.className = "beulah-ai__bubble";
  bubble.textContent = message.content;

  if (message.error) {
    bubble.classList.add("beulah-ai__error");
    const copy = document.createElement("p");
    copy.className = "beulah-ai__error-copy";
    copy.textContent = message.content;
    bubble.textContent = "";
    bubble.append(copy);

    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "beulah-ai__retry";
    retry.textContent = "Try again";
    retry.addEventListener("click", () => {
      if (pendingRetry) {
        const retryText = pendingRetry;
        pendingRetry = null;
        sendMessage(retryText);
      }
    });
    bubble.append(retry);
  }

  body.append(bubble);

  if (message.actions?.length) {
    const actions = document.createElement("div");
    actions.className = "beulah-ai__actions";

    for (const action of message.actions) {
      if (action.type === "navigate" && NAVIGATION_TARGETS[action.target]) {
        const link = document.createElement("a");
        link.className = "beulah-ai__action";
        link.href = NAVIGATION_TARGETS[action.target];
        link.textContent = action.target === "cart" ? "Open cart" :
          action.target === "orders" ? "View my orders" :
          action.target === "account" ? "Open my account" :
          action.target === "shop" ? "Browse products" :
          action.target === "how_to" ? "Open How To" : "Continue to checkout";
        actions.append(link);
      } else if (action.type === "support" && action.channel === "whatsapp" && /^https:\/\/wa\.me\/\d+$/.test(action.url || "")) {
        const link = document.createElement("a");
        link.className = "beulah-ai__action";
        link.href = action.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Chat with Beulah Foods on WhatsApp";
        actions.append(link);
      } else if (action.type === "confirm_mutation" && action.confirmation_id) {
        const button=document.createElement("button");
        button.type="button";
        button.className="beulah-ai__action";
        button.textContent=action.label||"Confirm action";
        button.addEventListener("click",async()=>{
          button.disabled=true;
          button.textContent="Confirming…";
          try {
            const data=await confirmAssistantMutation(action);
            applyActions(data.actions);
            addMessage("assistant",data.message||"The requested action was completed.",data.actions||[],{follow:true});
          } catch(error) {
            addMessage("assistant",customerError(error?.code),[],{error:true,follow:true});
            button.disabled=false;
            button.textContent=action.label||"Confirm action";
          }
        });
        actions.append(button);
      } else if (action.type === "order_created" && action.checkout_url) {
        const link = document.createElement("a");
        link.className = "beulah-ai__action";
        link.href = action.checkout_url;
        link.textContent = "Continue to checkout";
        actions.append(link);
      }
    }

    if (actions.children.length) body.append(actions);
  }

  if (message.role === "assistant" && !message.error && message.content) {
    const footer = document.createElement("div");
    footer.className = "beulah-ai__message-footer";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "beulah-ai__message-action";
    copyButton.innerHTML = icon("copy") + " Copy";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(message.content);
        copyButton.textContent = "Copied";
        setTimeout(() => {
          copyButton.innerHTML = icon("copy") + " Copy";
        }, 1400);
      } catch {
        copyButton.textContent = "Copy unavailable";
      }
    });

    footer.append(copyButton);
    body.append(footer);
  }

  article.append(body);
  return article;
}

function renderTranscript({ preserveScroll = false } = {}) {
  const list = getList();
  if (!list) return;

  const previousDistance = getDistanceFromBottom();
  list.querySelectorAll(".beulah-ai__message, .beulah-ai__thinking, .beulah-ai__empty").forEach(node => node.remove());

  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "beulah-ai__empty";
    empty.innerHTML =
      '<div class="beulah-ai__empty-icon">' + icon("bot") + '</div>' +
      '<p class="beulah-ai__empty-title">' + getWelcomeMessage() + '</p>' +
      '<p class="beulah-ai__empty-copy">Ask about Beulah Foods products, stock, cooking, orders, delivery or checkout.</p>';
    list.append(empty);
    updateScrollButton();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const message of messages) {
    fragment.append(createMessageElement(message, { animate: false }));
  }
  list.append(fragment);

  if (preserveScroll) {
    list.scrollTop = Math.max(0, list.scrollHeight - list.clientHeight - previousDistance);
  } else {
    list.scrollTop = list.scrollHeight;
  }
  updateScrollButton();
}

function addMessage(role, content, actions = [], options = {}) {
  const message = {
    id: crypto.randomUUID(),
    role,
    content: String(content || ""),
    actions,
    error: Boolean(options.error),
  };

  messages.push(message);

  const list = getList();
  if (!list) return null;

  list.querySelector(".beulah-ai__empty")?.remove();

  const element = createMessageElement(message);
  list.append(element);

  requestAnimationFrame(() => {
    if (options.anchor) {
      scrollToTurn(element);
    } else if (options.follow !== false) {
      scrollToLatest({ smooth: true, force: true });
    }
    updateScrollButton();
  });

  return message;
}

function removeThinking() {
  getList()?.querySelector(".beulah-ai__thinking")?.remove();
  updateCommandHintVisibility();
}

function updateCommandHintVisibility() {
  const root = document.querySelector(".beulah-ai");
  const hint = root?.querySelector(".beulah-ai__command-hint");
  const input = root?.querySelector(".beulah-ai__input");
  if (!hint || !input) return;

  const hasText = Boolean(String(input.value || "").trim());
  const isBusy = Boolean(root.querySelector(".beulah-ai__thinking"));
  hint.classList.toggle("is-active", !hasText && (isBusy || document.activeElement === input || !input.value));
}

function startCommandHintCycle(root) {
  const hint = root.querySelector(".beulah-ai__command-hint");
  const text = hint?.querySelector(".beulah-ai__command-hint-text");
  if (!hint || !text) return;

  let index = 0;
  const show = () => {
    text.classList.remove("is-visible");
    window.setTimeout(() => {
      text.textContent = AI_COMMAND_HINTS[index];
      text.classList.add("is-visible");
      index = (index + 1) % AI_COMMAND_HINTS.length;
      updateCommandHintVisibility();
    }, 180);
  };

  show();
  window.setInterval(show, 3000);
}

function getActionStatus(text) {
  const value = String(text || "").toLowerCase();
  if (/cancel.*reserv|release.*stock/.test(value)) return "Cancelling your reservation and releasing the reserved stock…";
  if (/reserve|confirm.*order|place.*order/.test(value)) return "Reserving your items for 15 minutes…";
  if (/add.*cart|put.*cart|add.*product|buy.*product/.test(value)) return "Finding the closest matching product…";
  if (/remove.*cart|take.*out.*cart/.test(value)) return "Removing the item from your cart…";
  if (/review.*(order|cart)|show.*cart|what.*in.*cart/.test(value)) return "Reviewing your current order…";
  if (/take me|go to|open.*(cart|orders|account|checkout|shop|how to)/.test(value)) return "Taking you to the requested page…";
  if (/product|price|stock|available|in stock|flour|meal|food/.test(value)) return "Finding the closest matching product…";
  return "Checking that for you…";
}

function showThinking(statusText = "Checking that for you…") {
  const list = getList();
  if (!list) return null;

  removeThinking();

  const node = document.createElement("div");
  node.className = "beulah-ai__thinking";
  node.setAttribute("role", "status");
  node.setAttribute("aria-label", "Beulah AI is thinking");
  node.innerHTML =
    '<span>' + String(statusText).replace(/[<>]/g, '') + '</span>' +
    '<span class="beulah-ai__thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>';

  list.append(node);
  return node;
}

async function loadConversationHistory() {
  if (historyLoaded) return;
  historyLoaded = true;

  try {
    const session = await getCurrentSession();
    const response = await fetch("/api/ai/history", {
      headers: session?.access_token
        ? { Authorization: "Bearer " + session.access_token }
        : {},
    });

    if (!response.ok) throw new Error("HISTORY_LOAD_FAILED");

    const data = await response.json();
    historyMessages = Array.isArray(data.messages)
      ? data.messages.slice(-30).map(item => ({
          id: crypto.randomUUID(),
          role: item.role === "assistant" ? "assistant" : "user",
          content: String(item.content || ""),
          actions: [],
          error: false,
        }))
      : [];

    // Keep server history ready in memory, but intentionally do not render it
    // until the customer starts a new message in this page interaction.
    if (!conversationStarted) {
      messages = [];
      renderTranscript();
    }
  } catch {
    historyMessages = [];
    messages = [];
    renderTranscript();
  }
}

async function clearConversation() {
  const clearButton = document.querySelector(".beulah-ai__clear");
  if (clearButton) clearButton.disabled = true;

  try {
    const session = await getCurrentSession();
    const response = await fetch("/api/ai/history", {
      method: "DELETE",
      headers: session?.access_token
        ? { Authorization: "Bearer " + session.access_token }
        : {},
    });

    if (!response.ok) throw new Error("CLEAR_FAILED");

    messages = [];
    historyMessages = [];
    conversationStarted = false;
    pendingRetry = null;
    renderTranscript();
  } catch {
    addMessage("assistant", "I couldn't clear this conversation. Please try again.", [], { error: true });
  } finally {
    if (clearButton) clearButton.disabled = false;
  }
}

function applyActions(actions) {
  for (const action of actions || []) {
    if (action.type !== "cart") continue;

    if (action.operation === "add") {
      addToCart(action.product_id, action.quantity);
    } else if (action.operation === "set") {
      updateCartQuantity(action.product_id, action.quantity);
    } else if (action.operation === "remove") {
      removeFromCart(action.product_id);
    }
  }
}

function customerError(errorCode) {
  if (errorCode === "AUTHENTICATION_REQUIRED") {
    return "Please log in to use that customer-account action.";
  }

  if (errorCode === "AI_NOT_CONFIGURED") {
    return "Beulah AI is temporarily unavailable. Please try again shortly.";
  }

  if (errorCode === "AI_HISTORY_DB_NOT_CONFIGURED") {
    return "The assistant is temporarily unavailable. Please try again shortly.";
  }

  return "I couldn't complete that request. Please try again.";
}

async function confirmAssistantMutation(action) {
  const session=await getCurrentSession();
  const response=await fetch("/api/ai/confirm",{method:"POST",headers:{"Content-Type":"application/json",...(session?.access_token?{Authorization:"Bearer "+session.access_token}:{})},body:JSON.stringify({mutation:action.mutation,confirmation_id:action.confirmation_id,cart:getCart()})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const error=new Error(data?.error||"ASSISTANT_CONFIRM_FAILED");error.code=data?.error||"ASSISTANT_CONFIRM_FAILED";throw error;}
  return data;
}

async function requestAssistant(text) {
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
    const error = new Error(data?.error || "ASSISTANT_REQUEST_FAILED");
    error.code = data?.error || "ASSISTANT_REQUEST_FAILED";
    throw error;
  }

  return data;
}

async function sendMessage(text) {
  const value = String(text || "").trim();
  const input = document.querySelector(".beulah-ai__input");
  const sendButton = document.querySelector(".beulah-ai__send");

  if (!value || sendButton?.disabled) return;

  if (!navigator.onLine) {
    addMessage("assistant", "You're offline right now. Please reconnect to the internet and try again.", [], {
      error: true,
      follow: true,
    });
    return;
  }

  if (!conversationStarted) {
    conversationStarted = true;
    messages = [...historyMessages];
    renderTranscript();
  }

  if (input) input.value = "";
  if (sendButton) {
    sendButton.disabled = true;
    sendButton.innerHTML = '<span aria-hidden="true">…</span>';
  }

  pendingRetry = value;
  addMessage("user", value, [], { anchor: true });
  input?.blur();
  showThinking(getActionStatus(value));

  const list = getList();
  if (list) {
    requestAnimationFrame(() => {
      const thinking = list.querySelector(".beulah-ai__thinking");
      if (thinking && isNearBottom(160)) {
        list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
      }
    });
  }

  try {
    const data = await requestAssistant(value);
    applyActions(data.actions);

    removeThinking();
    addMessage("assistant", data.message || "I couldn't produce a response.", data.actions || [], {
      follow: true,
    });
    pendingRetry = null;
  } catch (error) {
    removeThinking();

    const failedText = pendingRetry;
    addMessage("assistant", customerError(error?.code), [], { error: true, follow: true });

    const retry = document.querySelector(".beulah-ai__messages .beulah-ai__retry");
    retry?.addEventListener("click", () => {
      pendingRetry = failedText;
    }, { once: true });
  } finally {
    if (sendButton) {
      sendButton.disabled = false;
      sendButton.innerHTML = icon("send");
      sendButton.setAttribute("aria-label", "Send message");
    }

    // Do not focus the textarea here. On mobile that would reopen the keyboard
    // after the response and cover the latest message.
    input?.blur();
    updateScrollButton();
  }
}

function buildAssistant() {
  const root = document.createElement("div");
  root.className = "beulah-ai";

  root.innerHTML = `
    <section class="beulah-ai__panel" hidden aria-label="Beulah Foods AI assistant">
      <header class="beulah-ai__head">
        <div class="beulah-ai__identity">
          <div class="beulah-ai__avatar" aria-hidden="true">${icon("bot")}</div>
          <div class="beulah-ai__identity-copy">
            <strong class="beulah-ai__identity-title">Beulah AI</strong>
            <span class="beulah-ai__identity-status"><i class="beulah-ai__status-dot"></i>Beulah Foods assistant</span>
          </div>
        </div>

        <button class="beulah-ai__head-action beulah-ai__clear" type="button" aria-label="Clear conversation" title="Clear conversation">
          ${icon("trash")}
        </button>
        <button class="beulah-ai__head-action beulah-ai__close" type="button" aria-label="Close assistant" title="Close assistant">
          ${icon("close")}
        </button>
      </header>

      <div class="beulah-ai__notice">
        Beulah AI can make mistakes. Confirm important information with Beulah Foods.
      </div>

      <div class="beulah-ai__messages" role="log" aria-label="Conversation" aria-live="polite" tabindex="0">
        <button class="beulah-ai__scroll-down" type="button" aria-label="Jump to latest message" title="Jump to latest message">
          ${icon("down")}
        </button>
      </div>

      <form class="beulah-ai__form">
        <div class="beulah-ai__input-wrap">
          <div class="beulah-ai__command-hint" aria-live="polite" aria-label="Available Beulah AI commands">
            <span class="beulah-ai__command-hint-label">Commands</span>
            <span class="beulah-ai__command-hint-text"></span>
          </div>
          <textarea
            class="beulah-ai__input"
            rows="1"
            maxlength="2000"
            autocomplete="off"
            enterkeyhint="send"
            aria-label="Message Beulah AI"
            placeholder="Ask about Beulah Foods…"
          ></textarea>
        </div>

        <button class="beulah-ai__send" type="submit" aria-label="Send message" title="Send message">
          ${icon("send")}
        </button>
      </form>
    </section>

    <button class="beulah-ai__toggle" type="button" aria-label="Ask Beulah AI" aria-expanded="false">
      <svg class="beulah-ai__toggle-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H7l-3.5 2V11.5A7.5 7.5 0 0 1 11 4h1.5A7.5 7.5 0 0 1 20 11.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 12h.01M12 12h.01M16 12h.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </button>
  `;

  document.body.append(root);
  return root;
}

function resizeComposer(input) {
  if (!input) return;
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 110) + "px";
}

export function initAiAssistant() {
  if (initialized || document.querySelector(".admin-page")) return;
  initialized = true;

  ensureStylesheet();

  const viewportMeta = document.querySelector('meta[name="viewport"]');
  if (viewportMeta && !/interactive-widget=/i.test(viewportMeta.content)) {
    viewportMeta.content += ", interactive-widget=resizes-content";
  }

  const root = buildAssistant();
  const panel = root.querySelector(".beulah-ai__panel");
  const toggle = root.querySelector(".beulah-ai__toggle");
  const close = root.querySelector(".beulah-ai__close");
  const clear = root.querySelector(".beulah-ai__clear");
  const form = root.querySelector(".beulah-ai__form");
  const input = root.querySelector(".beulah-ai__input");
  const send = root.querySelector(".beulah-ai__send");
  const scrollDown = root.querySelector(".beulah-ai__scroll-down");
  const messageList = root.querySelector(".beulah-ai__messages");

  messageList.addEventListener("scroll", updateScrollButton, { passive: true });

  scrollDown.addEventListener("click", () => {
    scrollToLatest({ smooth: true, force: true });
    input?.blur();
  });

  const openAssistant = ({ restoreState = true } = {}) => {
    panel.hidden = false;
    toggle.classList.add("is-hidden");
    toggle.setAttribute("aria-expanded", "true");
    if (restoreState) {
      try { sessionStorage.setItem(AI_OPEN_STATE_KEY, "true"); } catch {}
    }

    if (!conversationStarted && !messages.length) renderTranscript();
    requestAnimationFrame(() => {
      updateScrollButton();
    });

    // Do not autofocus on mobile. The customer can tap the composer when ready.
  };

  toggle.addEventListener("click", () => openAssistant());

  close.addEventListener("click", () => {
    panel.hidden = true;
    toggle.classList.remove("is-hidden");
    toggle.setAttribute("aria-expanded", "false");
    input?.blur();
    try { sessionStorage.removeItem(AI_OPEN_STATE_KEY); } catch {}
  });

  clear.addEventListener("click", clearConversation);
  form.addEventListener("submit", event => {
    event.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener("input", () => {
    resizeComposer(input);
    updateCommandHintVisibility();
  });
  input.addEventListener("focus", updateCommandHintVisibility);

  startCommandHintCycle(root);

  initAiSlashCommands({
    root,
    input,
    onSelect: command => {
      if (command.send) {
        input.value = "";
        resizeComposer(input);
        sendMessage(command.prompt, send);
        return;
      }

      input.value = command.prompt;
      resizeComposer(input);
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    },
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input.value, send);
    }
  });

  loadConversationHistory();
  updateCommandHintVisibility();

  try {
    if (sessionStorage.getItem(AI_OPEN_STATE_KEY) === "true") {
      openAssistant({ restoreState: false });
    }
  } catch {}
}
