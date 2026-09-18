import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const aiSection = worker.slice(worker.indexOf("const AI_SYSTEM_PROMPT"));

test("AI tool contract is allowlisted", () => {
  for (const name of ["get_how_to","search_ai_knowledge","get_categories","search_products","get_product","get_store_policies","get_my_cart","get_my_orders","get_my_order","add_to_cart","update_cart","remove_from_cart","create_order","cancel_reservation","get_support_contact"]) {
    assert.match(aiSection, new RegExp("name:\"" + name + "\""));
  }
});

test("AI has no arbitrary execution tool", () => {
  assert.doesNotMatch(aiSection, /generic_sql|arbitrary_sql|arbitrary_http|fetch_url_tool/i);
});

test("customer order reads contain ownership filters", () => {
  const orders = aiSection.slice(aiSection.indexOf('case "get_my_orders"'), aiSection.indexOf('case "get_my_order"'));
  const order = aiSection.slice(aiSection.indexOf('case "get_my_order"'), aiSection.indexOf('case "add_to_cart"'));
  assert.match(orders, /customer_id/);
  assert.match(order, /customer_id/);
});

test("mutations require explicit confirmation", () => {
  assert.match(aiSection, /confirm_mutation/);
  assert.match(aiSection, /createAiConfirmation/);
  assert.match(aiSection, /claimAiConfirmation/);
});

test("chat and mutation rate limiting are enforced", () => {
  assert.match(worker, /enforceAiRateLimit\(request, env, auth, "chat"\)/);
  assert.match(worker, /enforceAiRateLimit\(request,env,auth,"mutation"\)/);
});

test("Paystack is outside the AI tool contract", () => {
  const tools = aiSection.slice(aiSection.indexOf("const AI_TOOLS"), aiSection.indexOf("function aiError"));
  assert.doesNotMatch(tools, /initializePaystack|verifyPaystack/);
});

test("rate limiting fails closed when bindings are missing", () => {
  assert.match(worker, /AI_RATE_LIMIT_NOT_CONFIGURED/);
});
