---
title: Fix license activation for reseller keys
description: Fixes the issue where licenses generated via the reseller panel fail to activate in the extension by ensuring proper plan linking and database privilege alignment.
---

## Problem
Users reported that licenses bought/generated through the reseller panel (`/revenda`) were giving connection errors or "invalid key" errors in the extension, while admin-generated keys worked fine. Investigation revealed:
1. `finalize_approved_payment_bulk` was potentially missing proper `plan_id` linkage in some edge cases during batch generation.
2. The `public.activate_license_device` function (used by the extension) needs to correctly handle licenses with `custom_duration_minutes` which are common in reseller orders.
3. Database functions needed consistent `SECURITY DEFINER` and `search_path` to avoid permission issues during the checkout/webhook flow.

## Changes

### Backend (Edge Functions & Database)
- Update `finalize_approved_payment_bulk` to strictly enforce `plan_id` from the payment record and ensure idempotency.
- Refine `activate_license_device` logic to prioritize duration calculation in this order: custom seconds > custom minutes > plan minutes > plan days.
- Ensure all relevant database functions (`finalize_approved_payment_bulk`, `activate_license_device`) are `SECURITY DEFINER` and have a restricted `search_path`.

### Extension
- Ensure `API_BASE` is consistent and that the activation attempt gracefully handles various error codes from the server.

## Verification Plan
1. **Database Check**: Run SQL to verify that `finalize_approved_payment_bulk` is correctly defined with `SECURITY DEFINER`.
2. **API Simulation**: Use a preview JS snippet to call `/api/public/license/activate` with a simulated reseller key to ensure it returns a valid session.
3. **Log Audit**: Check Supabase logs for any `403` or `500` errors during the activation path.
