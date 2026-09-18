const PAYSTACK_API = "https://api.paystack.co";
const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function getBearerToken(request) {
  const value = request.headers.get("Authorization") || "";
  if (!value.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token || null;
}

function requireSecret(env, name) {
  const value = env[name];
  if (!value) throw new Error(`SERVER_SECRET_NOT_CONFIGURED:${name}`);
  return value;
}

function ngnToKobo(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [naira, fraction = ""] = text.split(".");
  const kobo = BigInt(naira) * 100n + BigInt((fraction + "00").slice(0, 2));
  if (kobo <= 0n || kobo > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(kobo);
}

function koboToNgn(kobo) {
  if (typeof kobo === "number") {
    if (!Number.isSafeInteger(kobo) || kobo < 0) return null;
    return `${Math.floor(kobo / 100)}.${String(kobo % 100).padStart(2, "0")}`;
  }
  const text = String(kobo ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const value = BigInt(text);
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

async function supabaseRequest(env, path, { method = "GET", body, accessToken } = {}) {
  const secret = requireSecret(env, "SUPABASE_SECRET_KEY");
  const headers = { apikey: secret };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${env.SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

async function authenticateCustomer(request, env) {
  const token = getBearerToken(request);
  if (!token) return null;

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: requireSecret(env, "SUPABASE_SECRET_KEY"),
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  if (!user?.id || !user?.email) return null;
  return { token, user };
}

async function callCustomerRpc(env, functionName, args, accessToken) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: requireSecret(env, "SUPABASE_SECRET_KEY"),
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

async function callServiceRpc(env, functionName, args) {
  return supabaseRequest(env, `/rest/v1/rpc/${functionName}`, {
    method: "POST",
    body: args,
  });
}

async function paystackRequest(env, path, options = {}) {
  const secret = requireSecret(env, "PAYSTACK_SECRET_KEY");
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

async function initializePaystack(request, env) {
  const auth = await authenticateCustomer(request, env);
  if (!auth) return json({ error: "UNAUTHENTICATED" }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const orderId = String(body?.order_id || "").trim();
  if (!orderId) return json({ error: "ORDER_ID_REQUIRED" }, 400);

  const { response: rpcResponse, data: payment } = await callCustomerRpc(
    env,
    "create_paystack_payment_attempt",
    { target_order_id: orderId },
    auth.token,
  );

  if (!rpcResponse.ok) {
    const message = typeof payment === "object" && payment?.message ? payment.message : "PAYMENT_ATTEMPT_CREATION_FAILED";
    const code = message.includes("ORDER_RESERVATION_EXPIRED")
      ? "ORDER_RESERVATION_EXPIRED"
      : message.includes("ORDER_NOT_PAYABLE")
        ? "ORDER_NOT_PAYABLE"
        : message.includes("ORDER_NOT_FOUND")
          ? "ORDER_NOT_FOUND"
          : message.includes("UNAUTHENTICATED")
            ? "UNAUTHENTICATED"
            : "PAYMENT_ATTEMPT_CREATION_FAILED";
    return json({ error: code }, code === "UNAUTHENTICATED" ? 401 : 409);
  }

  const amountNgn = String(payment?.amount ?? "").trim();
  const amountKobo = ngnToKobo(amountNgn);
  const reference = String(payment?.reference || "");
  if (amountKobo === null || !reference) return json({ error: "PAYMENT_ATTEMPT_INVALID" }, 500);

  const callbackUrl = `${new URL(request.url).origin}/payment-callback.html`;
  const paystack = await paystackRequest(env, "/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: auth.user.email,
      amount: String(amountKobo),
      currency: "NGN",
      reference,
      callback_url: callbackUrl,
      metadata: JSON.stringify({
        order_id: payment.order_id,
        payment_id: payment.payment_id,
        source: "beulah-foods-web",
      }),
    }),
  });

  if (!paystack.response.ok || !paystack.data?.status || !paystack.data?.data?.authorization_url) {
    return json({ error: "PAYMENT_INITIALIZATION_FAILED" }, 502);
  }

  return json({
    authorization_url: paystack.data.data.authorization_url,
    access_code: paystack.data.data.access_code,
    reference: paystack.data.data.reference || reference,
    payment_id: payment.payment_id,
    order_id: payment.order_id,
  });
}

async function getPaymentForCustomer(env, reference, userId) {
  const query = new URLSearchParams({
    select: "id,order_id,reference,amount,currency,status,orders!inner(id,order_number,customer_id,total,payment_status)",
    reference: `eq.${reference}`,
    "orders.customer_id": `eq.${userId}`,
    limit: "1",
  });
  const { response, data } = await supabaseRequest(env, `/rest/v1/payments?${query.toString()}`);
  if (!response.ok || !Array.isArray(data) || !data[0]) return null;
  return data[0];
}

async function finalizePayment(env, paymentData) {
  const amountNgn = koboToNgn(paymentData.amount_kobo);
  if (amountNgn === null) throw new Error("INVALID_PROVIDER_AMOUNT");

  const { response, data } = await callServiceRpc(env, "finalize_paystack_payment", {
    p_reference: paymentData.reference,
    p_provider_transaction_id: paymentData.provider_transaction_id == null ? null : String(paymentData.provider_transaction_id),
    p_amount_ngn: amountNgn,
    p_currency: paymentData.currency || "NGN",
    p_provider_status: String(paymentData.provider_status || ""),
    p_metadata: paymentData.metadata && typeof paymentData.metadata === "object" ? paymentData.metadata : {},
  });
  if (!response.ok) {
    const message = typeof data === "object" && data?.message ? data.message : "PAYMENT_FINALIZATION_FAILED";
    throw new Error(message);
  }
  return data;
}

async function loadOrderSummary(env, orderId) {
  const query = new URLSearchParams({
    select: "id,order_number,status,payment_status,total",
    id: `eq.${orderId}`,
    limit: "1",
  });
  const { response, data } = await supabaseRequest(env, `/rest/v1/orders?${query.toString()}`);
  if (!response.ok || !Array.isArray(data)) return null;
  return data[0] || null;
}

async function verifyPaystack(request, env) {
  const auth = await authenticateCustomer(request, env);
  if (!auth) return json({ error: "UNAUTHENTICATED" }, 401);

  let reference = new URL(request.url).searchParams.get("reference");
  if (request.method === "POST") {
    try {
      const body = await request.json();
      reference = body?.reference || reference;
    } catch {
      return json({ error: "INVALID_JSON" }, 400);
    }
  }
  reference = String(reference || "").trim();
  if (!reference) return json({ error: "REFERENCE_REQUIRED" }, 400);

  const payment = await getPaymentForCustomer(env, reference, auth.user.id);
  if (!payment) return json({ error: "PAYMENT_NOT_FOUND" }, 404);

  const paystack = await paystackRequest(env, `/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
  if (!paystack.response.ok || !paystack.data?.status || !paystack.data?.data) {
    return json({ error: "PAYMENT_VERIFICATION_FAILED" }, 502);
  }

  const transaction = paystack.data.data;
  const result = await finalizePayment(env, {
    reference,
    provider_transaction_id: transaction.id,
    amount_kobo: transaction.amount,
    currency: transaction.currency,
    provider_status: transaction.status,
    metadata: transaction,
  });
  const orderId = result?.order_id || payment.order_id;
  const order = await loadOrderSummary(env, orderId);

  return json({
    payment_status: result?.status || transaction.status,
    order_id: orderId,
    order_number: order?.order_number || null,
    provider_status: transaction.status,
    idempotent: Boolean(result?.idempotent),
  });
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyPaystackSignature(rawBody, signature, secret) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = bytesToHex(digest);
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return mismatch === 0;
}

async function handleWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  const secret = requireSecret(env, "PAYSTACK_SECRET_KEY");
  if (!(await verifyPaystackSignature(rawBody, signature, secret))) return json({ error: "INVALID_WEBHOOK_SIGNATURE" }, 401);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  if (event?.event !== "charge.success") return json({ received: true, ignored: true });

  const data = event?.data;
  const reference = String(data?.reference || "").trim();
  if (!reference || data?.amount == null) return json({ error: "INVALID_PAYMENT_EVENT" }, 400);

  try {
    const result = await finalizePayment(env, {
      reference,
      provider_transaction_id: data.id,
      amount_kobo: data.amount,
      currency: data.currency,
      provider_status: data.status,
      metadata: event,
    });
    return json({ received: true, processed: true, status: result?.status || "processed" });
  } catch (error) {
    console.error("Paystack webhook finalization failed", error);
    return json({ error: "PAYMENT_FINALIZATION_FAILED" }, 502);
  }
}


const AI_MODEL = "@cf/zai-org/glm-4.7-flash";
const AI_MAX_HISTORY = 12;
const AI_MAX_TOOL_ROUNDS = 4;
const AI_MAX_MESSAGE_CHARS = 2000;
const AI_MAX_CART_ITEMS = 50;

const AI_SYSTEM_PROMPT = [
  "You are the Beulah Foods customer assistant.",
  "Use tools for current product, stock, order, cart, and policy information. Never invent a price, stock level, product, order status, delivery rule, or policy.",
  "Only use a customer's own order data. Never reveal another customer's information.",
  "You may modify the customer's browser cart through controlled cart tools. Never claim a cart changed unless the tool succeeded.",
  "You may create a pending order/reservation when the customer explicitly asks to place the order and the required delivery profile is complete. Payment remains user-controlled.",
  "You may cancel a pending reservation when the customer explicitly asks.",
  "Never initialize Paystack or claim that a payment succeeded.",
  "Do not modify products, prices, stock, categories, customer profiles, payments, or administrative data. Do not delete orders. Do not run arbitrary SQL.",
  "If an action needs authentication, say that the customer must log in. If delivery details are missing, explain which profile fields are required.",
  "Keep responses concise and grounded in tool results."
].join(" ");

const AI_TOOLS = [

  {name:"get_how_to",description:"Read Beulah Foods customer instructions. Use type order for ordering instructions, or type cooking for preparation guides; optionally provide a product_id or product_slug.",parameters:{type:"object",properties:{type:{type:"string",enum:["order","cooking"]},product_id:{type:"string"},product_slug:{type:"string"},limit:{type:"integer",minimum:1,maximum:5}},required:["type"],additionalProperties:false}},
  {name:"search_ai_knowledge",description:"Search the Beulah Foods admin-maintained knowledge base for current FAQs, ordering, cooking, product, delivery, policy, and general information.",parameters:{type:"object",properties:{query:{type:"string"},limit:{type:"integer",minimum:1,maximum:8}},required:["query"],additionalProperties:false}},  {name:"get_categories",description:"List active Beulah Foods product categories.",parameters:{type:"object",properties:{},additionalProperties:false}},
  {name:"search_products",description:"Search active Beulah Foods products by name, description, or category slug. Returns current price and available stock.",parameters:{type:"object",properties:{query:{type:"string"},category_slug:{type:"string"},limit:{type:"integer",minimum:1,maximum:8}},additionalProperties:false}},
  {name:"get_product",description:"Get one active product by product ID or slug, including current price and available stock.",parameters:{type:"object",properties:{product_id:{type:"string"},slug:{type:"string"}},additionalProperties:false}},
  {name:"get_store_policies",description:"Read the current Privacy Policy or Terms of Service.",parameters:{type:"object",properties:{document:{type:"string",enum:["privacy","terms"]}},required:["document"],additionalProperties:false}},
  {name:"get_my_cart",description:"Read and enrich the customer's current browser cart.",parameters:{type:"object",properties:{},additionalProperties:false}},
  {name:"get_my_orders",description:"List the authenticated customer's own recent orders.",parameters:{type:"object",properties:{limit:{type:"integer",minimum:1,maximum:10}},additionalProperties:false}},
  {name:"get_my_order",description:"Get one of the authenticated customer's own orders by order ID or order number.",parameters:{type:"object",properties:{order_id:{type:"string"},order_number:{type:"string"}},additionalProperties:false}},
  {name:"add_to_cart",description:"Validate availability and return a client action to add a product to the browser cart.",parameters:{type:"object",properties:{product_id:{type:"string"},quantity:{type:"integer",minimum:1,maximum:50}},required:["product_id","quantity"],additionalProperties:false}},
  {name:"update_cart",description:"Validate availability and return a client action to set a browser-cart quantity.",parameters:{type:"object",properties:{product_id:{type:"string"},quantity:{type:"integer",minimum:1,maximum:50}},required:["product_id","quantity"],additionalProperties:false}},
  {name:"remove_from_cart",description:"Return a client action to remove a product from the browser cart.",parameters:{type:"object",properties:{product_id:{type:"string"}},required:["product_id"],additionalProperties:false}},
  {name:"create_order",description:"Create a pending order and its existing 15-minute reservation from the authenticated customer's browser cart. Payment is not started.",parameters:{type:"object",properties:{promo_code:{type:"string"}},additionalProperties:false}},
  {name:"cancel_reservation",description:"Cancel the authenticated customer's pending order reservation.",parameters:{type:"object",properties:{order_id:{type:"string"}},required:["order_id"],additionalProperties:false}}
];

function aiError(message, code="AI_TOOL_ERROR") { return {ok:false,code,message}; }

function sanitizeCart(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, AI_MAX_CART_ITEMS).map(item => ({
    productId:String(item?.productId || "").trim(),
    quantity:Number.parseInt(item?.quantity,10)
  })).filter(item => item.productId && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity <= 50);
}

async function getAvailableStock(env, productIds) {
  const ids=[...new Set(productIds.map(String).filter(Boolean))];
  if (!ids.length) return new Map();
  const query=new URLSearchParams({
    select:"product_id,quantity,reservations!inner(status,expires_at)",
    product_id:"in.("+ids.join(",")+")",
    "reservations.status":"eq.active"
  });
  const {response,data}=await supabaseRequest(env,"/rest/v1/reservation_items?"+query.toString());
  if (!response.ok || !Array.isArray(data)) throw new Error("STOCK_LOOKUP_FAILED");
  const reserved=new Map();
  for (const row of data) {
    if (Date.parse(row?.reservations?.expires_at || "") <= Date.now()) continue;
    const id=String(row.product_id);
    reserved.set(id,(reserved.get(id)||0)+Number(row.quantity||0));
  }
  return reserved;
}

async function getActiveProducts(env,{productId,slug,query,categorySlug,limit=8}={}) {
  const safeLimit=Math.min(8,Math.max(1,Number.parseInt(limit,10)||8));
  const params=new URLSearchParams({
    select:"id,category_id,name,slug,description,price,stock_quantity,image_path,is_featured,categories(name,slug)",
    is_active:"eq.true",
    order:"sort_order.asc,name.asc",
    limit:String(safeLimit)
  });
  if (productId) params.set("id","eq."+String(productId).trim());
  if (slug) params.set("slug","eq."+String(slug).trim());
  if (categorySlug) params.set("categories.slug","eq."+String(categorySlug).trim());
  if (query) {
    const text=String(query).trim().replace(/[%(),]/g," ").slice(0,80);
    if (text) params.set("or","(name.ilike.*"+text+"*,description.ilike.*"+text+"*)");
  }
  const {response,data}=await supabaseRequest(env,"/rest/v1/products?"+params.toString());
  if (!response.ok || !Array.isArray(data)) throw new Error("PRODUCT_LOOKUP_FAILED");
  const reserved=await getAvailableStock(env,data.map(row=>row.id));
  return data.map(row=>({
    id:row.id,name:row.name,slug:row.slug,description:row.description,
    price_ngn:Number(row.price),
    available_stock:Math.max(0,Number(row.stock_quantity||0)-Number(reserved.get(String(row.id))||0)),
    category:row.categories?{name:row.categories.name,slug:row.categories.slug}:null,
    is_featured:Boolean(row.is_featured)
  }));
}

async function getCustomerProfileForAi(env,auth) {
  if (!auth) return null;
  const query=new URLSearchParams({select:"id,full_name,phone,address",id:"eq."+auth.user.id,limit:"1"});
  const {response,data}=await supabaseRequest(env,"/rest/v1/customer_profiles?"+query.toString(),{accessToken:auth.token});
  if (!response.ok || !Array.isArray(data)) return null;
  return data[0] || null;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function getStorePolicy(env,document) {
  const path=document==="privacy"?"/storefront/privacy-policy.html":"/storefront/terms-of-service.html";
  const response=await env.ASSETS.fetch(new Request("https://assets.local"+path));
  if (!response.ok) throw new Error("POLICY_DOCUMENT_UNAVAILABLE");
  return {document,text:stripHtml(await response.text()).slice(0,7000)};
}


async function executeAiTool(env,auth,toolName,args,context) {
  const cart=context.cart;
  const requireAuth=()=>{if(!auth) throw new Error("AUTHENTICATION_REQUIRED");};

  switch(toolName) {
    case "get_how_to": {
      const type=String(args?.type||"").trim();
      const limit=Math.min(5,Math.max(1,Number.parseInt(args?.limit,10)||5));
      if(type==="order"){
        const {response,data}=await supabaseRequest(env,"/rest/v1/how_to_order?select=id,title,description,is_active,how_to_order_steps(id,step_number,title,description)&is_active=eq.true&limit=1");
        if(!response.ok || !Array.isArray(data)) throw new Error("HOW_TO_ORDER_LOOKUP_FAILED");
        return {guides:data};
      }
      let products=[];
      if(args?.product_id || args?.product_slug){
        products=await getActiveProducts(env,{productId:args?.product_id,slug:args?.product_slug,limit:1});
      } else {
        products=await getActiveProducts(env,{limit});
      }
      const ids=products.map(p=>p.id);
      if(!ids.length) return {guides:[]};
      const params=new URLSearchParams({
        select:"id,product_id,title,description,is_active,how_to_steps(id,step_number,title,description)",
        is_active:"eq.true",
        product_id:"in.("+ids.join(",")+")",
        limit:String(limit)
      });
      const {response,data}=await supabaseRequest(env,"/rest/v1/how_to_guides?"+params.toString());
      if(!response.ok || !Array.isArray(data)) throw new Error("HOW_TO_COOKING_LOOKUP_FAILED");
      const byId=new Map(products.map(p=>[String(p.id),p]));
      return {guides:data.map(g=>({...g,product:byId.get(String(g.product_id))||null}))};
    }
    case "search_ai_knowledge": {
      const query=String(args?.query||"").trim();
      if(!query) throw new Error("KNOWLEDGE_QUERY_REQUIRED");
      const {response,data}=await supabaseRequest(env,"/rest/v1/rpc/search_ai_knowledge",{
        method:"POST",
        body:{p_query:query,p_limit:Math.min(8,Math.max(1,Number.parseInt(args?.limit,10)||6))}
      });
      if(!response.ok || !Array.isArray(data)) throw new Error("KNOWLEDGE_SEARCH_FAILED");
      return {results:data};
    }
    case "get_categories": {
      const query=new URLSearchParams({select:"id,name,slug,description",is_active:"eq.true",order:"sort_order.asc,name.asc"});
      const {response,data}=await supabaseRequest(env,"/rest/v1/categories?"+query.toString());
      if(!response.ok || !Array.isArray(data)) throw new Error("CATEGORY_LOOKUP_FAILED");
      return {categories:data};
    }
    case "search_products":
      return {products:await getActiveProducts(env,{query:args?.query,categorySlug:args?.category_slug,limit:args?.limit})};
    case "get_product": {
      if(!args?.product_id && !args?.slug) throw new Error("PRODUCT_IDENTIFIER_REQUIRED");
      const products=await getActiveProducts(env,{productId:args?.product_id,slug:args?.slug,limit:1});
      return {product:products[0]||null};
    }
    case "get_store_policies":
      return await getStorePolicy(env,String(args?.document||""));
    case "get_my_cart": {
      const items=[];
      for(const item of cart) {
        const result=await getActiveProducts(env,{productId:item.productId,limit:1});
        items.push({product_id:item.productId,quantity:item.quantity,product:result[0]||null});
      }
      return {items};
    }
    case "get_my_orders": {
      requireAuth();
      const limit=Math.min(10,Math.max(1,Number.parseInt(args?.limit,10)||10));
      const query=new URLSearchParams({
        select:"id,order_number,status,payment_status,subtotal,discount_amount,delivery_fee,total,currency,created_at,paid_at",
        customer_id:"eq."+auth.user.id,order:"created_at.desc",limit:String(limit)
      });
      const {response,data}=await supabaseRequest(env,"/rest/v1/orders?"+query.toString(),{accessToken:auth.token});
      if(!response.ok || !Array.isArray(data)) throw new Error("ORDER_LOOKUP_FAILED");
      return {orders:data};
    }
    case "get_my_order": {
      requireAuth();
      if(!args?.order_id && !args?.order_number) throw new Error("ORDER_IDENTIFIER_REQUIRED");
      const query=new URLSearchParams({
        select:"id,order_number,status,payment_status,subtotal,discount_amount,delivery_fee,total,currency,created_at,paid_at,order_items(product_id,product_name,unit_price,quantity,line_total)",
        customer_id:"eq."+auth.user.id,limit:"1"
      });
      if(args.order_id) query.set("id","eq."+String(args.order_id).trim());
      else query.set("order_number","eq."+String(args.order_number).trim());
      const {response,data}=await supabaseRequest(env,"/rest/v1/orders?"+query.toString(),{accessToken:auth.token});
      if(!response.ok || !Array.isArray(data)) throw new Error("ORDER_LOOKUP_FAILED");
      return {order:data[0]||null};
    }
    case "add_to_cart":
    case "update_cart": {
      const productId=String(args?.product_id||"").trim();
      const requested=Number.parseInt(args?.quantity,10);
      if(!productId || !Number.isFinite(requested) || requested<1 || requested>50) throw new Error("INVALID_CART_QUANTITY");
      const products=await getActiveProducts(env,{productId,limit:1});
      const product=products[0];
      if(!product) throw new Error("PRODUCT_UNAVAILABLE");
      const existing=cart.find(item=>String(item.productId)===productId)?.quantity||0;
      const finalQuantity=toolName==="add_to_cart"?existing+requested:requested;
      if(finalQuantity>product.available_stock) throw new Error("INSUFFICIENT_STOCK:"+product.available_stock);
      return {
        action:{type:"cart",operation:toolName==="add_to_cart"?"add":"set",product_id:productId,quantity:toolName==="add_to_cart"?requested:finalQuantity},
        product:{id:product.id,name:product.name,price_ngn:product.price_ngn,available_stock:product.available_stock}
      };
    }
    case "remove_from_cart": {
      const productId=String(args?.product_id||"").trim();
      if(!productId) throw new Error("PRODUCT_IDENTIFIER_REQUIRED");
      return {action:{type:"cart",operation:"remove",product_id:productId}};
    }
    case "create_order": {
      requireAuth();
      if(!cart.length) throw new Error("CART_EMPTY");
      const profile=await getCustomerProfileForAi(env,auth);
      if(!profile?.full_name?.trim() || !profile?.phone?.trim() || !profile?.address?.trim()) {
        return {requires_profile:true,missing_fields:[!profile?.full_name?.trim()?"full_name":null,!profile?.phone?.trim()?"phone":null,!profile?.address?.trim()?"address":null].filter(Boolean)};
      }
      const {response,data}=await callCustomerRpc(env,"create_pending_order",{
        cart_items:cart.map(item=>({productId:item.productId,quantity:item.quantity})),
        delivery_name:profile.full_name.trim(),
        delivery_phone:profile.phone.trim(),
        delivery_address:profile.address.trim(),
        requested_promo_code:String(args?.promo_code||"").trim()||null
      },auth.token);
      if(!response.ok) throw new Error(typeof data==="object"&&data?.message?data.message:"ORDER_CREATION_FAILED");
      return {
        order_created:true,order_id:data.order_id,order_number:data.order_number,reservation_id:data.reservation_id,expires_at:data.expires_at,total:data.total,discount:data.discount,
        action:{type:"order_created",order_id:data.order_id,order_number:data.order_number,checkout_url:"/checkout.html?order="+encodeURIComponent(data.order_id)}
      };
    }
    case "cancel_reservation": {
      requireAuth();
      const orderId=String(args?.order_id||"").trim();
      if(!orderId) throw new Error("ORDER_IDENTIFIER_REQUIRED");
      const {response,data}=await callCustomerRpc(env,"cancel_pending_order",{target_order_id:orderId},auth.token);
      if(!response.ok) throw new Error(typeof data==="object"&&data?.message?data.message:"RESERVATION_CANCELLATION_FAILED");
      return {cancelled:true,order_id:orderId,action:{type:"reservation_cancelled",order_id:orderId}};
    }
    default: throw new Error("UNKNOWN_AI_TOOL");
  }
}

function normalizeAiHistory(history) {
  if(!Array.isArray(history)) return [];
  return history.slice(-AI_MAX_HISTORY).map(message=>{
    const role=message?.role==="assistant"?"assistant":"user";
    const content=String(message?.content||"").slice(0,AI_MAX_MESSAGE_CHARS);
    return content?{role,content}:null;
  }).filter(Boolean);
}

function extractAiText(response) {
  const choice=response?.choices?.[0];
  return String(choice?.message?.content||response?.response||"").trim();
}

async function runAiChat(request,env) {
  let body;
  try { body=await request.json(); } catch { return json({error:"INVALID_JSON"},400); }
  const message=String(body?.message||"").trim();
  if(!message) return json({error:"MESSAGE_REQUIRED"},400);
  if(message.length>AI_MAX_MESSAGE_CHARS) return json({error:"MESSAGE_TOO_LONG"},413);

  const auth=await authenticateCustomer(request,env);
  const cart=sanitizeCart(body?.cart);
  const history=normalizeAiHistory(body?.history);
  const messages=[
    {role:"system",content:AI_SYSTEM_PROMPT},
    {role:"system",content:JSON.stringify({signed_in:Boolean(auth),current_cart_items:cart.length})},
    ...history,
    {role:"user",content:message}
  ];
  if(!env.AI?.run) return json({error:"AI_NOT_CONFIGURED"},503);

  const actions=[];
  let response;
  let rounds=0;
  while(rounds<AI_MAX_TOOL_ROUNDS) {
    rounds+=1;
    response=await env.AI.run(AI_MODEL,{
      messages,
      tools:AI_TOOLS,
      tool_choice:"auto",
      temperature:0.2,
      max_tokens:900,
      user:auth?.user?.id||"anonymous"
    });
    const toolCalls=Array.isArray(response?.tool_calls)?response.tool_calls:[];
    if(!toolCalls.length) break;

    messages.push({role:"assistant",content:JSON.stringify(toolCalls)});
    for(const toolCall of toolCalls.slice(0,4)) {
      const toolName=String(toolCall?.name||"").trim();
      let args=toolCall?.arguments||{};
      if(typeof args==="string") {
        try { args=JSON.parse(args); } catch { args={}; }
      }
      let result;
      try {
        result=await executeAiTool(env,auth,toolName,args,{cart});
      } catch(error) {
        result=aiError(error?.message||"The requested operation could not be completed.",String(error?.message||"AI_TOOL_ERROR").split(":")[0]);
      }
      if(result?.action) actions.push(result.action);
      messages.push({role:"tool",content:JSON.stringify(result)});
    }
  }

  const text=extractAiText(response);
  if(!text) return json({error:"AI_EMPTY_RESPONSE"},502);
  return json({message:text,actions,model:AI_MODEL});
}

const STOREFRONT_PAGES = new Set([
  "login",
  "signup",
  "forgot-password",
  "reset-password",
  "verification-success",
  "account",
  "shop",
  "product",
  "cart",
  "checkout",
  "orders",
  "order",
  "payment-callback",
]);

function assetRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/storefront/" || path === "/storefront/index.html") {
    const storefrontUrl = new URL(request.url);
    storefrontUrl.pathname = "/storefront/index.html";
    return env.ASSETS.fetch(new Request(storefrontUrl, request));
  }

  if (path.startsWith("/storefront/") && path.endsWith(".html")) {
    const filename = path.slice("/storefront/".length);
    const canonical = new URL(request.url);
    canonical.pathname = `/${filename}`;
    return Response.redirect(canonical, 301);
  }

  if (path === "/") {
    const storefrontUrl = new URL(request.url);
    storefrontUrl.pathname = "/storefront/index.html";
    return env.ASSETS.fetch(new Request(storefrontUrl, request));
  }

  if (path === "/admin") {
    const canonical = new URL(request.url);
    canonical.pathname = "/admin/";
    return Response.redirect(canonical, 301);
  }

  if (path === "/admin/") {
    const adminUrl = new URL(request.url);
    adminUrl.pathname = "/admin/index.html";
    return env.ASSETS.fetch(new Request(adminUrl, request));
  }

  const cleanPath = path.replace(/^\//, "");
  if (STOREFRONT_PAGES.has(cleanPath)) {
    const storefrontUrl = new URL(request.url);
    storefrontUrl.pathname = `/storefront/${cleanPath}.html`;
    return env.ASSETS.fetch(new Request(storefrontUrl, request));
  }

  if (
    path.endsWith(".html") &&
    !path.startsWith("/storefront/") &&
    !path.startsWith("/admin/")
  ) {
    const storefrontUrl = new URL(request.url);
    storefrontUrl.pathname = `/storefront${path}`;
    return env.ASSETS.fetch(new Request(storefrontUrl, request));
  }

  // Storefront HTML is exposed at root-level URLs, but its static files
  // remain under /storefront in the asset bundle. Map those root-relative
  // CSS, JS, image, and other asset requests back to the storefront tree.
  if (!path.startsWith("/admin/") && !path.startsWith("/storefront/")) {
    const storefrontAssetUrl = new URL(request.url);
    storefrontAssetUrl.pathname = `/storefront${path}`;
    return env.ASSETS.fetch(new Request(storefrontAssetUrl, request));
  }

  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/ai/chat") {
        if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
        return await runAiChat(request, env);
      }

      if (url.pathname === "/api/paystack/initialize") {
        if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
        return await initializePaystack(request, env);
      }

      if (url.pathname === "/api/paystack/verify") {
        if (request.method !== "GET" && request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "GET, POST" });
        return await verifyPaystack(request, env);
      }

      if (url.pathname === "/api/paystack/webhook") {
        if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { Allow: "POST" });
        return await handleWebhook(request, env);
      }

      return await assetRequest(request, env);
    } catch (error) {
      console.error(error);
      const message = error?.message || "INTERNAL_SERVER_ERROR";
      if (message.startsWith("SERVER_SECRET_NOT_CONFIGURED:")) return json({ error: "PAYMENT_SERVER_NOT_CONFIGURED" }, 503);
      return json({ error: "INTERNAL_SERVER_ERROR" }, 500);
    }
  },
};
