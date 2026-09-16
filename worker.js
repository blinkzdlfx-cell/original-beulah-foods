export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Payment routes are intentionally not implemented until the new
    // Supabase project and payment contract are in place. Do not return
    // mock payment state from the Worker.
    if (url.pathname.startsWith("/api/paystack/")) {
      return Response.json(
        {
          error: "PAYMENT_BOUNDARY_NOT_CONFIGURED",
          message: "The Paystack server boundary has not been configured yet.",
        },
        { status: 503 },
      );
    }

    return env.ASSETS.fetch(request);
  },
};
