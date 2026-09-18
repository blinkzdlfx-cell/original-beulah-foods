const COMMANDS = Object.freeze([
  { id: "add", label: "Add to cart", description: "Find a product and add it to your cart.", prompt: "Add a product to my cart", send: false },
  { id: "remove", label: "Remove from cart", description: "Find a product and remove it from your cart.", prompt: "Remove a product from my cart", send: false },
  { id: "products", label: "Check products", description: "Find products, prices, and current stock.", prompt: "Show me the products available right now", send: false },
  { id: "cart", label: "Review cart", description: "Review the products currently in my cart.", prompt: "Show me my current cart", send: true },
  { id: "reserve", label: "Reserve items", description: "Reserve the items in my cart for 15 minutes.", prompt: "Reserve the items in my cart", send: true },
  { id: "cancel", label: "Cancel reservation", description: "Cancel my current pending reservation.", prompt: "Cancel my current reservation", send: true },
  { id: "help", label: "Help & contact", description: "Get the current Beulah Foods contact information.", prompt: "/help", send: true },
]);

let styleLoaded = false;

function ensureStylesheet() {
  if (styleLoaded || document.querySelector('link[data-beulah-ai-slash-styles]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/storefront/css/ai-slash-commands.css?v=1";
  link.dataset.beulahAiSlashStyles = "true";
  document.head.append(link);
  styleLoaded = true;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function commandMatches(command, query) {
  if (!query) return true;
  const value = normalize(query);
  return normalize(command.id).includes(value) ||
    normalize(command.label).includes(value) ||
    normalize(command.description).includes(value);
}

function renderMenu(root, input, onSelect) {
  const menu = root.querySelector(".beulah-ai__slash-menu");
  if (!menu) return;

  const raw = String(input.value || "");
  const query = raw.startsWith("/") ? raw.slice(1).trim() : "";
  const commands = COMMANDS.filter(command => commandMatches(command, query));

  menu.replaceChildren();

  if (!raw.startsWith("/") || raw.includes("\n") || raw.includes(" ")) {
    menu.hidden = true;
    return;
  }

  menu.hidden = false;

  if (!commands.length) {
    const empty = document.createElement("div");
    empty.className = "beulah-ai__slash-empty";
    empty.textContent = "No matching command";
    menu.append(empty);
    return;
  }

  for (const command of commands) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "beulah-ai__slash-command";
    button.dataset.commandId = command.id;
    button.innerHTML =
      '<span class="beulah-ai__slash-command-name">/' + command.id + " · " + command.label + "</span>" +
      '<span class="beulah-ai__slash-command-description"></span>";
    button.querySelector(".beulah-ai__slash-command-description").textContent = command.description;

    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => {
      menu.hidden = true;
      onSelect(command);
    });

    menu.append(button);
  }
}

export function initAiSlashCommands({ root, input, onSelect }) {
  if (!root || !input || typeof onSelect !== "function") return;
  if (root.dataset.beulahAiSlashReady === "true") return;

  ensureStylesheet();
  root.dataset.beulahAiSlashReady = "true";

  const inputWrap = root.querySelector(".beulah-ai__input-wrap");
  if (!inputWrap) return;

  const menu = document.createElement("div");
  menu.className = "beulah-ai__slash-menu";
  menu.hidden = true;
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "Beulah AI commands");
  inputWrap.append(menu);

  input.addEventListener("input", () => renderMenu(root, input, onSelect));
  input.addEventListener("focus", () => renderMenu(root, input, onSelect));

  input.addEventListener("keydown", event => {
    if (event.key === "Escape" && !menu.hidden) {
      menu.hidden = true;
      event.preventDefault();
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && !menu.hidden) {
      const first = menu.querySelector(".beulah-ai__slash-command");
      if (first) {
        event.preventDefault();
        first.click();
      }
    }
  });

  document.addEventListener("click", event => {
    if (!root.contains(event.target)) menu.hidden = true;
  });

  renderMenu(root, input, onSelect);
}
