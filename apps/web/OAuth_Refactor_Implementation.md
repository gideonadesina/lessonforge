# LessonForge OAuth Refactor - Implementation Summary

## Overview
This document describes the refactoring of Google OAuth authentication flow in LessonForge to be fast, deterministic, and reliable like ChatGPT/Claude.

## Problems Fixed

### Before
- ❌ OAuth success but users stuck on "Finishing setup..." state
- ❌ Post-auth logic running on login form (button loading state)
- ❌ Multiple redirect mechanisms competing (middleware, layout, client effects)
- ❌ Race conditions in session syncing
- ❌ No clear separation of concerns
- ❌ Poor error messaging and recovery

### After
- ✅ OAuth → immediate full-screen loading state
- ✅ All post-auth logic server-side in dedicated route
- ✅ Single source of truth for post-auth navigation
- ✅ Timeouts with fallback UI (10s default)
- ✅ Idempotent operations (safe to refresh/retry)
- ✅ Comprehensive logging for debugging
- ✅ Clean error pages with recovery options

## New Architecture

### Flow Diagram
```
User clicks "Google Sign In"
    ↓
Stores intent (role) → redirects to OAuth provider
    ↓
Google redirects to /auth/callback?code=...
    ↓
Client shows loading overlay
    ↓
Supabase auto-exchanges code for session
    ↓
Client calls POST /api/auth/callback
    ↓
Server:
  1. Gets session (code already exchanged)
  2. Creates/finds profile
  3. Resolves available roles
  4. Claims initial role if needed
  5. Sets active-role cookie
    ↓
Server returns redirectUrl
    ↓
Client navigates to /dashboard or /principal/dashboard
```

### New Routes

#### 1. `/auth/callback` (Client Component)
**File:** `app/(auth)/callback/page.tsx`

Shows loading overlay while Supabase handles OAuth code exchange and backend setup.

**Key Points:**
- Client component (use client)
- Shows `AuthLoadingOverlay` during setup
- Waits 500ms for Supabase to exchange code
- Calls POST `/api/auth/callback`
- Handles errors and shows fallback UI
- Redirects on success

**Timeout Handling:**
- Shows "Setup taking longer than expected" after 5s
- Offers "Try Again" or "Select Role" options

#### 2. `/api/auth/callback` (API Route)
**File:** `app/api/auth/callback/route.ts`

Server-side OAuth setup and role provisioning.

**Stages (logged at each step):**
1. `getting_session` - Verify Supabase session exists
2. `ensuring_profile` - Create/find user profile row
3. `resolving_roles` - Query available roles for user
4. `determining_role` - Pick correct role (new users → teacher)
5. `claiming_role` - Bootstrap initial role if needed
6. `setting_cookie` - Set `lessonforge-active-role` cookie
7. Returns redirect URL

**Idempotency:**
- Profile creation: Checks if exists before inserting
- Role claiming: Only happens if no roles exist
- All operations are query-idempotent

**Configuration:**
- `maxDuration: 10` seconds (Vercel serverless limit)
- Should never timeout in normal conditions
- Server logs include durations and stage data

**Logging:**
```
[API /auth/callback] START
[API /auth/callback] Session found { userId: "123", email: "..." }
[API /auth/callback] Profile ensured { userId: "123" }
[API /auth/callback] Roles resolved { availableRoles: ["teacher"], ... }
[API /auth/callback] Target role determined { targetRole: "teacher", isNew: true }
[API /auth/callback] Initial role claimed { userId: "123", targetRole: "teacher" }
[API /auth/callback] SUCCESS { userId: "123", totalMs: 450, stages: [...] }
```

#### 3. `/auth/error` (Error Handling)
**File:** `app/(auth)/error/page.tsx`

Displays auth errors with helpful messaging.

**Error Codes:**
- `no_code` - OAuth provider didn't return code
- `setup_failed` - Backend setup encountered error
- `timeout` - Setup took too long

**Features:**
- Shows user-friendly error message
- Links to basic support email
- Development mode shows debug info
- "Try Again" and "Select Role" buttons

### Modified Routes

#### `/auth/{role}` (RoleAuthScreen Component)
**File:** `components/auth/RoleAuthScreen.tsx`

**Changes:**
- ✅ Removed OAuth callback handling from useEffect
- ✅ Changed OAuth redirect to `/auth/callback` (was `/auth/{role}`)
- ✅ Removed `syncingRole` state (no longer needed)
- ✅ Removed `syncUserRoleAndRedirect` function (OAuth now server-side)
- ✅ Removed "Finishing setup..." button text
- ✅ Kept email auth flow unchanged

**Still Handles:**
- Email signup with validation
- Email login
- Role selection UI
- Referral code handling

### New Components

#### `AuthLoadingOverlay` Component
**File:** `components/auth/AuthLoadingOverlay.tsx`

Full-screen loading state for OAuth callback processing.

**Features:**
- Smooth fade-in animation
- Animated spinner with gradient
- Customizable title and subtitle
- Optional timeout message
- Teacher-premium-first aesthetic
- Mobile-responsive

**Usage:**
```tsx
<AuthLoadingOverlay
  title="Finishing setup..."
  subtitle="Setting up your workspace"
  showFallback={showFallback}
  onTimeout={handleTimeout}
/>
```

## Implementation Details

### Session Handling
1. **Code Exchange:** Handled automatically by Supabase browser client
2. **Server Verification:** API checks that session exists before processing
3. **Cookie Setting:** After role is determined, set `lessonforge-active-role` cookie
4. **Response:** Client redirects using returned `redirectUrl`

### Role Determination Logic
```typescript
// Priority order:
// 1. If no roles exist → claim "teacher" (new users default)
// 2. If one role exists → use it
// 3. If multiple roles → use stored active role or first
```

### Error Recovery
Each error type has a recovery path:
- **No Session** → "Try signing in again"
- **Profile Error** → "Contact support + retry"
- **Role Error** → "Try again + role selection"
- **Timeout** → "Continue to dashboard if available + retry"

## Testing Checklist

### Happy Path
- [ ] Click "Google Sign In"
- [ ] See loading overlay immediately
- [ ] Redirects to /dashboard after 1-2 seconds
- [ ] Cookie shows correct role
- [ ] Profile exists in database
- [ ] Server logs show all stages

### Error Cases
- [ ] Close browser during callback → shows error
- [ ] Network failure → shows timeout after 5s
- [ ] Invalid session → shows permission error
- [ ] Database error → shows setup failed message

### Multiple Roles
- [ ] User with teacher + principal roles
- [ ] Correct role selected after OAuth
- [ ] Cookie set correctly

### Refresh/Idempotency
- [ ] Refresh during callback → completes
- [ ] Manual navigation to /auth/callback → completes
- [ ] Refresh after landing in dashboard → stays in dashboard

## Logging & Debugging

### Enable Detailed Logs
```bash
# View in browser console
window.localStorage.setItem("DEBUG_AUTH", "true");

# View on server
# Check deployment logs for [API /auth/callback] messages
# Includes: userId, stage, timestamp, duration
```

### Example Log Output
```
[OAuth Callback] Processing callback
[API /auth/callback] START
[API /auth/callback] Session found {"userId": "12345", "email": "teacher@school.com"}
[API /auth/callback] Profile ensured {"userId": "12345"}
[API /auth/callback] Roles resolved {"availableRoles": ["teacher"], "profileRole": null}
[API /auth/callback] Target role determined {"targetRole": "teacher", "isNew": true}
[API /auth/callback] Initial role claimed {"userId": "12345", "targetRole": "teacher"}
[API /auth/callback] SUCCESS {"userId": "12345", "targetRole": "teacher", "redirectUrl": "/dashboard", "totalMs": 450}
```

## Performance Characteristics

### Typical Flow Timing
- OAuth exchange: ~200ms (handled by browser)
- Server-side setup: ~300-500ms
- Total perceived time: 1-2 seconds

### Timeout Configuration
- Endpoint timeout: 10 seconds (Vercel limit)
- Client fallback: 5 seconds
- Never should timeout in normal conditions

## Cookie Management

### `lessonforge-active-role`
- **Set:** During POST `/api/auth/callback`
- **Duration:** 1 year
- **Path:** `/`
- **SameSite:** Lax (allows cross-site, but not in bad ways)
- **Secure:** Only HTTPS in production
- **Used by:** Middleware/layout for role-based routing

## Migration Notes

### For Existing Sessions
- First OAuth with this code → sets cookie
- Existing sessions still work (cookies persist)
- Old login flows unaffected

### For Database
- No schema changes required
- Profile creation works with existing schema
- Backward compatible

### For Environment
- No new env vars needed
- Uses existing Supabase credentials
- Works with current infrastructure

## Future Improvements

### Phase 2
- [ ] Webhook for role claim events (analytics)
- [ ] Faster profile initialization (batch create on signup)
- [ ] Progressive enhancement for slow networks
- [ ] Support for multiple OAuth providers

### Phase 3
- [ ] Real-time role provisioning status
- [ ] School admin bulk user provisioning
- [ ] SAML integration with school systems

## Rollback Plan

If issues occur:
1. Revert `RoleAuthScreen.tsx` changes
2. Change OAuth `redirectTo` back to `/auth/{role}`
3. Restore old useEffect OAuth handling
4. Remove or disable new callback routes

Existing sessions will continue to work during rollback.
