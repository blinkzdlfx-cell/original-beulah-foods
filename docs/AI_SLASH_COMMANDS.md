# Beulah AI Slash Commands

## Purpose

The storefront slash-command palette is a lightweight UI shortcut layer for common product and cart actions. It is intentionally separate from the main AI assistant component.

The palette does not contain product names, prices, stock, URLs, or other catalogue data. Product references continue through the existing Beulah AI resolver and controlled Worker tools.

## Commands

- `/add` — add a product to the cart
- `/remove` — remove a product from the cart
- `/products` — check products, prices, and current stock
- `/cart` — review the current cart
- `/reserve` — reserve cart items for 15 minutes
- `/cancel` — cancel a pending reservation
- `/help` — compose current contact and location information from the public storefront footer

## Help command

`/help` is routed through the existing `/api/ai/chat` endpoint.

The Worker reads the current public footer at request time and supplies the verified footer source to the configured AI provider. The provider may reorganize the information into a natural customer-facing response, but it must not change, abbreviate, invent, normalize, or reinterpret important contact information such as:

- address
- phone number
- WhatsApp number
- email address
- company name
- location names

The footer remains the source of truth. No contact number or address is hard-coded into the slash-command UI.

## Separation of responsibilities

- `storefront/js/components/aiSlashCommands.js` owns command discovery, filtering, keyboard selection, and command selection.
- `storefront/css/ai-slash-commands.css` owns the palette presentation and subtle animation.
- `storefront/js/components/aiAssistant.js` only routes selected commands into the existing assistant send flow.
- `worker.js` owns footer retrieval, AI composition for `/help`, rate limiting, history persistence, and all existing AI/tool boundaries.

The slash layer does not create a second AI tool system and does not bypass existing authentication, mutation confirmation, stock, reservation, or payment boundaries.

## UI behavior

Typing `/` opens the command palette. Typing immediately after the slash filters the available commands.

- Enter selects the first matching command.
- Escape closes the palette.
- Clicking outside closes the palette.
- Commands use a short fade/translate animation.
- `prefers-reduced-motion` disables the animation.

Commands that require more information, such as `/add` or `/remove`, place a natural prompt in the composer so the customer can specify the product. Commands that can be executed directly submit their prompt through the existing assistant flow.
