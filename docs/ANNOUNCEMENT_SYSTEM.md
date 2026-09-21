# Announcement System

The Beulah Foods announcement system uses a structured content model rather than treating every announcement as a card.

## Model

- **Content:** title, short description, optional image, optional CTA.
- **Placement:** the storefront page selected by `target_page`.
- **Presentation:** `inline`, `banner`, `featured`, or `modal`.
- **Behavior:** active window, sequence, dismissible, and show-once.

## Presentation rules

- **Inline:** compact, non-interruptive announcement content.
- **Banner:** horizontal notice intended for high-visibility, short messages.
- **Featured:** larger visual announcement with optional image and CTA.
- **Modal:** interruptive announcement. Only the highest-priority matching modal is shown.

## Safety

- CTA URLs accept same-site paths or HTTP(S) URLs only.
- Announcement HTML is escaped before rendering.
- Public storefront access is still controlled by the existing active/start/expiry RLS policy.
- Dismissal/show-once state is stored locally in the visitor's browser.
- Admin-only mutation remains protected by the existing admin policy.

## Compatibility

The original `display_mode` column remains as legacy data during this migration. New writes use `display_type`; existing `card` announcements are treated as `inline` and existing `banner` announcements remain `banner`.
