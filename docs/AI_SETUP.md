# Beulah AI — TEST Setup

This document is the final external setup checklist for the Beulah AI implementation. Production is intentionally out of scope.

## 1. Create the TEST D1 database

From the repository root, authenticate Wrangler to the correct TEST Cloudflare account and run:

```bash
npx wrangler d1 create original-beulah-ai
```

Copy the returned database ID.

Then uncomment the D1 binding in wrangler.toml and replace the placeholder with the real ID:

```toml
[[d1_databases]]
binding = "AI_DB"
database_name = "original-beulah-ai"
database_id = "<REAL_TEST_D1_DATABASE_ID>"
```

Do not commit a fake or guessed database ID.

## 2. Apply the D1 schema

Run the migration against the TEST database:

```bash
npx wrangler d1 execute original-beulah-ai --remote --file=d1/migrations/0001_ai_chat.sql
```

The migration creates the conversation/message tables and indexes. It inserts no sample data.

## 3. Configure Worker secrets

The existing Beulah Foods Worker still requires:

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put PAYSTACK_SECRET_KEY
```

The AI provider fallbacks are optional:

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put HUGGINGFACE_API_KEY
```

Only add the optional secrets if those providers are being enabled.

## 4. Configure AI models

wrangler.toml contains:

- AI_PROVIDER_ORDER = cloudflare,openrouter,huggingface
- AI_CLOUDFLARE_MODEL = @cf/zai-org/glm-4.7-flash
- AI_OPENROUTER_MODEL = empty until a tool-capable model is selected
- AI_HUGGINGFACE_MODEL = empty until a tool-capable model is selected

An empty optional provider model causes that provider to be skipped. This means Cloudflare Workers AI can operate by itself after D1 is configured.

For OpenRouter and Hugging Face, choose models that support the tool/function-calling contract used by Beulah AI before enabling them as fallbacks.

## 5. Deploy TEST

After the D1 binding and any desired provider configuration are in place:

```bash
npx wrangler deploy
```

The Worker cron schedule is already configured for 02:00 UTC daily. The scheduled handler deletes conversations inactive for more than seven days.

## 6. Acceptance tests

Run these in TEST:

### History
- Open the assistant and send a message.
- Refresh the page.
- Confirm the previous conversation loads from D1.
- Navigate to another storefront page and confirm the same conversation remains available.
- Use Clear and confirm the D1 conversation is deleted and a new conversation starts.
- Confirm no assistant message bodies remain in browser localStorage.

### Retention
- Confirm every chat updates updated_at.
- Confirm scheduled execution removes conversations older than seven days.
- Confirm messages belonging to deleted conversations are removed.

### Provider routing
- Cloudflare enabled alone: response succeeds.
- Cloudflare failure with OpenRouter configured: request falls back to OpenRouter.
- OpenRouter failure with Hugging Face configured: request falls back to Hugging Face.
- Confirm provider/model returned by the API matches the provider that actually answered.
- Confirm tool calls work through every enabled fallback model.

### Security
- Signed-in customer A cannot read customer B's conversation.
- A guest conversation cannot be read through another conversation ID.
- Internal prompts, tool definitions, secrets, database details, and private admin information are not returned.
- D1 contains only customer-visible user/assistant messages.

### Beulah actions
- Product lookup uses live Supabase catalogue data.
- Stock lookup uses live reservation-aware stock.
- Cart actions update the browser cart only after validation.
- Customer order lookup is restricted to the authenticated customer.
- Pending-order creation uses the existing authenticated order RPC.
- AI never starts Paystack or claims payment success.

## Current implementation boundary

Supabase remains the operational source of truth. D1 is only the conversational persistence layer. Cloudflare Workers AI/OpenRouter/Hugging Face are model providers. The Worker remains the security and orchestration boundary.

No production database, production Worker, or production payment configuration is part of this implementation.
