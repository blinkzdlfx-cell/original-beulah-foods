# Beulah Foods Offline Handling

## Status

Implemented in the TEST storefront on 2026-09-19.

## Goals

The storefront should remain usable as a website shell when network connectivity is lost without pretending that backend-dependent operations succeeded.

## Architecture

The offline layer has four parts:

1. **Service worker — `/sw.js`**
   - Caches the main customer-facing HTML shell and the offline fallback page.
   - Uses network-first navigation so fresh online pages remain authoritative.
   - Caches successful same-origin static GET requests for later offline use.
   - Does not intercept `/api/*` requests.
   - Falls back to `/offline.html` when a navigation cannot be served from cache.

2. **Offline state manager — `storefront/js/components/offlineState.js`**
   - Runs from the shared storefront navbar initialization.
   - Registers the service worker.
   - Listens for browser online/offline events.
   - Shows a global offline banner.
   - Shows a short connection-restored state after connectivity returns.

3. **Offline styling — `storefront/css/offline-state.css`**
   - Provides the global connection banner without modifying page-specific components.

4. **AI network boundary**
   - Beulah AI does not pretend to answer while offline.
   - The composer request is blocked when the browser is offline.
   - The customer receives a clear reconnect message.
   - AI history and AI responses remain server-backed.

## What works offline

Where the relevant page/assets have already been cached:

- storefront shell and navigation
- previously visited/static customer pages
- cached CSS, JavaScript, images, and other successful same-origin GET assets
- local UI behavior that does not require a server response

## What remains online-only

These operations require a live connection and authoritative backend state:

- Beulah AI requests
- product/stock retrieval
- account/session operations
- order creation
- reservation creation/cancellation
- payment initialization and payment verification
- order history and other live customer data

The offline layer must never display a fabricated success for these operations.

## Cart policy

The current implementation does not introduce a second offline cart database. Existing cart behavior remains unchanged until an explicit synchronization design is approved. This avoids conflicts between local cart state, live stock, reservations, and the authoritative backend.

## Recovery behavior

When connectivity returns:

- the global banner reports that the connection was restored
- normal API operations become available again
- navigation continues to use the network-first service-worker strategy
- no automatic payment/order mutation is attempted

## Cache lifecycle

The service worker uses a versioned cache name. A future shell change should increment the cache version so obsolete cached assets can be removed during activation.

## Acceptance checklist

- [ ] Load the storefront once while online so the service worker can install and cache the shell.
- [ ] Refresh while online and confirm normal navigation still works.
- [ ] Disable the network and confirm the offline banner appears.
- [ ] Navigate to a previously visited/cached page and confirm it loads.
- [ ] Navigate to an uncached page while offline and confirm the offline fallback appears.
- [ ] Open Beulah AI while offline and confirm a request is not sent and a reconnect message is shown.
- [ ] Restore connectivity and confirm the restored banner appears.
- [ ] Confirm AI, checkout, order, reservation, and payment operations require connectivity.
- [ ] Confirm the service worker does not intercept `/api/*` requests.

Production resources remain untouched.
