# Staff and Branch Manager Restaurant Assignments: Architecture & Implementation Plan

## 1. Overview & Objectives

Enhance the Foodi application to support restaurant assignments for both **Staff** and **Branch Manager** designations.
The feature enables restaurant owners to assign staff members to one or multiple restaurants, integrating assignments with login, authentication, permissions, dashboard access, and strict backend data isolation.

---

## 2. Existing Architecture & Findings

1. **Owner vs Staff Roles**:
   - Owners are in `seller_owners` and can own multiple restaurants via `seller_owners.seller_id` (primary) and `seller_owner_restaurants` (additional).
   - Staff members are in `users` (role `seller_staff`) and linked via `seller_staff`.
   - Staff permissions are stored in `seller_staff_permissions` (one key per module: `dashboard`, `orders`, `pos`, `menu`, etc.).
   - Designations are stored in `staff_designations` (built-in job titles with `seller_id = NULL`, or custom titles with `seller_id` set).
2. **Current Staff-Restaurant Limitation**:
   - `seller_staff` table has a single `seller_id` column, restricting each staff user to only 1 restaurant.
   - `StaffAuthContext` holds only one `sellerId: number`.
   - `requireSellerStaff` checks `X-Seller-Id` against `context.sellerId` only.
   - `RestaurantSwitcher` on frontend renders a static non-interactive card for all staff members regardless of restaurants.
3. **SEO & Metadata**:
   - `seller/src/app/(dashboard)/layout.tsx` enforces `robots: noIndex` for all dashboard pages.
   - Staff management and login pages are excluded from search indexing.

---

## 3. Database Design

### New Migration: `create_seller_staff_restaurants`
A single reusable junction table associating staff with restaurants:

```sql
CREATE TABLE seller_staff_restaurants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  seller_staff_id INT UNSIGNED NOT NULL,
  seller_id INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT seller_staff_restaurants_unique UNIQUE (seller_staff_id, seller_id),
  CONSTRAINT seller_staff_restaurants_staff_fk FOREIGN KEY (seller_staff_id) REFERENCES seller_staff (id) ON DELETE CASCADE,
  CONSTRAINT seller_staff_restaurants_seller_fk FOREIGN KEY (seller_id) REFERENCES sellers (id) ON DELETE CASCADE,
  INDEX seller_staff_restaurants_seller_idx (seller_id)
);
```

### Data Preservation & Seeding:
- Existing `seller_staff` rows are automatically backfilled:
  `INSERT INTO seller_staff_restaurants (seller_staff_id, seller_id, created_at) SELECT id, seller_id, created_at FROM seller_staff`
- `Branch Manager` is added to built-in designations in `staff_designations`:
  `INSERT IGNORE INTO staff_designations (seller_id, name) VALUES (NULL, 'Branch Manager')`
- `seller_staff.seller_id` is maintained for backward compatibility (stores primary/first restaurant).

---

## 4. Backend Architecture & Changes

1. **Designations & Permissions (`server/src/shared/constants/seller-permissions.ts`)**:
   - Add `'Branch Manager'` to `BUILT_IN_DESIGNATIONS`.
   - Designation remains a job title; permissions remain granular module keys in `seller_staff_permissions`.
2. **Validation (`seller-staff.validation.ts`)**:
   - Support `sellerIds: z.array(idSchema).min(1)` (and backward-compatible `sellerId: idSchema`).
   - Server-side verification that all requested `sellerIds` belong to the authenticated owner and are `APPROVED`.
3. **Repository & Service (`seller-staff.repository.ts`, `seller-staff.service.ts`)**:
   - Support batch fetching assigned restaurants with `listStaffRestaurants(staffIds)`.
   - Atomic replacement of assignments via `replaceStaffRestaurants(staffId, sellerIds, db)`.
   - Update `StaffDto` to return `restaurants: Array<{ id: number; name: string; status?: string }>`.
4. **Staff Auth & Context (`seller-staff-auth.service.ts`, `seller-staff-auth.repository.ts`)**:
   - In `findAccountByEmail` / `findSessionContext`: query all active approved assignments.
   - `canSignIn`: verify staff has at least 1 active approved restaurant.
   - Return all assigned restaurants in `user.restaurants`.
   - In `StaffAuthContext`: include `assignedSellerIds: number[]`.
5. **Authorization Middleware (`require-seller-staff.middleware.ts`, `require-seller-access.middleware.ts`)**:
   - Inspect `X-Seller-Id` header:
     - If provided: verify `Number(header)` is in `staff.assignedSellerIds`. If not, return 403 Forbidden. Set active `staff.sellerId = Number(header)`.
     - If not provided: if `assignedSellerIds.length === 1`, default to that restaurant; if multiple, require `X-Seller-Id` header.
   - If assignments are revoked in the DB, access stops immediately on the next request.

---

## 5. Frontend Architecture & Changes

1. **Staff Registration Form (`seller/src/features/staff/components/staff-form.tsx`)**:
   - Retrieve operational restaurants from authenticated backend context (`meta.restaurants`).
   - **Case A (Owner has 1 restaurant)**:
     - Automatically assign the single restaurant.
     - Display restaurant name in a read-only input.
     - Do not require manual selection.
   - **Case B (Owner has multiple restaurants)**:
     - Render multi-select checkboxes for restaurants.
     - Require at least one restaurant.
     - Clearly display selected restaurant names.
     - Allow changing selection before submission.
2. **Staff Manager & Details (`seller/src/features/staff/components/staff-manager.tsx`)**:
   - Display assigned restaurant names in table and details view.
   - Support editing assignments for existing staff.
3. **Restaurant Switcher (`seller/src/features/restaurants/components/restaurant-switcher.tsx`)**:
   - If staff member has 1 assigned restaurant: show static non-selectable display.
   - If staff member has multiple assigned restaurants: show dropdown switcher displaying only assigned restaurants, allowing seamless switching.
   - Switching active restaurant updates `X-Seller-Id` header and refreshes all relevant dashboard data.
   - Safe fallback if staff has no assigned restaurants.

---

## 6. Security & SEO

- **Security**:
  - Full server-side validation of restaurant ownership.
  - Strict data isolation on all endpoints via `X-Seller-Id` validation against `assignedSellerIds`.
  - Immediate revocation enforcement via database check on every request.
- **SEO**:
  - Dashboard, staff management, and login pages maintain `noindex`.
  - No sensitive PII or restaurant data leaked in public metadata.


---

## 7. Owner vs Staff Route Isolation & Error Handling

1. **Owner-Only Route Protection (`seller/src/features/auth/require-owner.tsx`, `(owner)/layout.tsx`)**:
   - Gated `/restaurants` and `/restaurants/new` with `RequireOwner`.
   - If a signed-in staff member accesses an owner-only URL directly, an informative restricted-access screen is displayed with a shortcut back to `/dashboard`, preventing staff from submitting owner applications.
2. **Backend Error Clarity (`server/src/middleware/require-seller-owner.middleware.ts`)**:
   - If a valid staff token is presented to an owner-only endpoint, the server responds immediately with `403 Forbidden` (`'Only restaurant owners can perform this action.'`).
   - Prevents client-side refresh loops and replaces obscure `Invalid or expired token` errors with clear authorization feedback.
