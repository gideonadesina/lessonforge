# OAuth Refactor - Testing & Rollout Guide

## Pre-Deployment Checklist

### Code Review
- [ ] Review `/app/(auth)/callback/page.tsx` - Loading overlay logic
- [ ] Review `/app/api/auth/callback/route.ts` - Server-side setup
- [ ] Check `components/auth/RoleAuthScreen.tsx` changes
- [ ] Validate `AuthLoadingOverlay.tsx` styling

### Build & Lint
```bash
npm run build
npm run lint
npm run type-check
```

### Local Testing Setup
```bash
# 1. Set up OAuth credentials in Google Cloud Console
# 2. Add callback URL to allowed redirects:
#    - http://localhost:3000/auth/callback
#    - https://yourdomain.com/auth/callback

# 3. Start dev server
npm run dev

# 4. Open browser console and run:
localStorage.setItem("DEBUG_AUTH", "true");
```

## Testing Scenarios

### Scenario 1: New User - Google OAuth (Happy Path)
**Goal:** Complete flow from OAuth to dashboard in <2 seconds

**Steps:**
1. Go to `/auth/teacher`
2. Click "Continue with Google"
3. Complete OAuth flow
4. Should see loading overlay
5. Should take <2s to redirect to `/dashboard`

**Verify:**
- ✅ Full-screen loading overlay shows
- ✅ No form elements visible during callback
- ✅ Browser logs show OAuth flow
- ✅ Lands in correct dashboard
- ✅ Server logs show stages
- ✅ Profile created in database
- ✅ Cookie set with role

**Server Log Check:**
```
Check → Vercel/server logs for:
[API /auth/callback] SUCCESS { ... totalMs: <1000 }
```

### Scenario 2: User with Existing Profile - Google OAuth
**Goal:** Reuses existing profile, sets cookie

**Steps:**
1. User already has account (created via email auth)
2. Click "Google Sign In" with same email
3. Should redirect to dashboard in <2s

**Verify:**
- ✅ No duplicate profile created
- ✅ Existing profile used
- ✅ Role resolved correctly
- ✅ Correct dashboard loaded

### Scenario 3: Principal First-Time OAuth
**Goal:** Defaults to principal role, not teacher

**Setup:**
- Create OAuth with email that has no roles
- Use `/auth/principal` link

**Note:**
- Current implementation defaults to teacher role
- TODO: Add way to request principal role at OAuth time
- Workaround: User can switch role after signing in

### Scenario 4: Slow Network - Timeout Handling
**Goal:** Shows helpful message if setup takes >5s

**Steps:**
1. Open DevTools → Network throttling → Slow 3G
2. Click "Continue with Google"
3. Wait for loading to show
4. After 5s, "taking longer than expected" message appears
5. Can click "Try Again" or "Select Role"

**Verify:**
- ✅ Overlay stays visible during slow network
- ✅ Doesn't crash or show raw errors
- ✅ Recovery options available

### Scenario 5: Network Failure - API Error
**Goal:** Shows error page with recovery options

**Steps:**
1. Open DevTools → Network → Offline
2. Click "Continue with Google"
3. OAuth completes but API fails
4. Should show error page

**Verify:**
- ✅ Error page displays
- ✅ "Try Again" button works
- ✅ "Select Role" button works
- ✅ Support link present

### Scenario 6: Email Auth - Not Affected
**Goal:** Ensure email signup/login still works

**Steps:**
1. Go to `/auth/teacher`
2. Click signup
3. Enter email/password/name
4. Should create account and redirect

**Verify:**
- ✅ Email auth unchanged
- ✅ Account created
- ✅ Profile created
- ✅ Lands in dashboard

### Scenario 7: Role Switching
**Goal:** User can switch between multiple roles

**Steps:**
1. Sign in with account that has teacher + principal roles
2. Use role selector in settings
3. Cookie should update
4. Should redirect to correct dashboard

**Verify:**
- ✅ Cookie updated
- ✅ Correct dashboard loads
- ✅ No auth redirects

### Scenario 8: Idempotency - Refresh During Callback
**Goal:** Refreshing page during setup doesn't break flow

**Steps:**
1. Start OAuth
2. During loading overlay, hit F5 to refresh
3. Should continue automatically
4. Should NOT create duplicate profile
5. Should land in correct dashboard

**Verify:**
- ✅ No errors on refresh
- ✅ Single profile in database
- ✅ Correct final state

### Scenario 9: Multi-Tab Behavior
**Goal:** Multiple tabs don't cause conflicts

**Steps:**
1. Tab A: Start OAuth flow
2. Tab B: Start OAuth flow simultaneously
3. Both should complete independently
4. Both should have correct profiles and cookies

**Verify:**
- ✅ No race conditions
- ✅ Both tabs land correctly
- ✅ Single clean profile per user

## Monitoring After Deployment

### 1. Error Rate Monitoring
```
Watch metrics:
- /auth/callback page load errors
- POST /api/auth/callback error responses
- Error page (`/auth/error`) views

Alert if:
- >2% POST /api/auth/callback failures
- >10 error page views/hour from new users
```

### 2. Performance Metrics
```
Watch:
- Time from /auth/callback to redirect (target: <2s)
- API endpoint duration (target: <1s)
- Full flow time (OAuth + setup)

Alert if:
- Average duration >3s
- P95 duration >5s
```

### 3. User Funnel
```
Track:
1. "Google Sign In" clicks
2. Redirects to /auth/callback
3. Successful profile creation
4. Successful redirects
5. Successful dashboard loads

Alert if:
- Drop-off >5% between any stage
- >10% error rate at any stage
```

### 4. Log Analysis
```
Grep patterns:
- [API /auth/callback] SUCCESS → should be 95%+
- [API /auth/callback] FAILED → investigate
- totalMs > 2000 → might be slow, not critical
```

### 5. Session Coverage
```
Verify:
- New users have lessonforge-active-role cookie
- Cookie value matches their role
- Cookie persists across page load
```

## Rollback Procedure

If critical issues found:

### Step 1: Identify Issue
```
Check logs for:
- Specific error messages
- Which stage is failing
- Affected user segments
```

### Step 2: Quick Fix vs Rollback Decision
```
Quick Fix if:
- Single configuration issue
- Easily patchable value change
- Low risk to existing sessions

Rollback if:
- Core flow broken
- Multiple stages failing
- User complaints about redirection
```

### Step 3: Rollback Steps
```bash
# 1. Revert files (most critical)
git revert <commit>

# 2. Key changes to rollback:
# - app/(auth)/callback/page.tsx → DELETE
# - app/api/auth/callback/route.ts → DELETE
# - components/auth/RoleAuthScreen.tsx → REVERT handleSocialSignIn
# - components/auth/AuthLoadingOverlay.tsx → DELETE

# 3. Rebuild
npm run build

# 4. Deploy
vercel deploy --prod
```

### Step 4: Verify Rollback
```bash
# 1. Test OAuth flow with test account
# 2. Verify old redirect URL works
# 3. Check user reports/errors diminish
# 4. Monitor error rates return to baseline
```

## Communication

### To Product/Leadership
> "Deployed OAuth refactor to improve post-signup experience. OAuth flow now redirects immediately with full-screen loading state instead of form-based loading. Expect to see faster perceived sign-in times and fewer support tickets from stuck auth state."

### To Support Team
> "Google OAuth sign-in now works faster and more reliably. If users report being stuck on 'Finishing setup...', it means the old code is still running. New behavior: full-screen loading, instant redirect. If they see error page, there's a specific setup issue - logs available."

### To QA
> "OAuth refactor complete. New test scenarios:
> - Slow network timeout handling
> - Error page recovery flows
> - Idempotency (refresh during callback)
> - Role determination for new users
> 
> Expected: Fast deterministic flow, no 'stuck loading' states, clear error messages."

## Post-Deployment Analytics

### Track These Metrics
1. **Signup completion rate** - Should stay same or improve
2. **Auth error rate** - Should be similar or lower
3. **Time to confirmation** - Should be faster
4. **User support tickets** - Should decrease (fewer "stuck" reports)
5. **Bounce rate** - Should not increase

### Success Criteria
- ✅ <1% OAuth error rate
- ✅ <2s average time to dashboard
- ✅ No increase in support tickets
- ✅ Positive user feedback on speed
- ✅ No regression in other auth flows

## Known Limitations & TODOs

### Current Implementation
1. **Teacher Default** - New OAuth users default to teacher role
   - TODO: Pass requested role through OAuth flow
   - Impact: Principals need to manually switch role after signup

2. **No Email Verification on OAuth**
   - OAuth providers already verified email
   - User sees no confirmation step
   - This is actually good UX

3. **No Custom Welcome Flow**
   - Goes straight to dashboard
   - TODO: Add onboarding flow for new users if needed
   - Could show "Welcome! Complete your profile" if needed

### Future Enhancements
- [ ] Progressive form reveal during loading
- [ ] Brand customization on loading overlay
- [ ] School-specific branding in loading states
- [ ] Real-time progress steps (Creating profile... Resolving roles...)
- [ ] Analytics integration for signup funnel

## Success Criteria - FINAL CHECKLIST

- [ ] OAuth redirects to `/auth/callback` (not `/auth/{role}`)
- [ ] Full-screen loading overlay shows (not button loading)
- [ ] No "Finishing setup..." message stuck state
- [ ] Complete in <2s for typical conditions
- [ ] Timeout fallback works after 5s
- [ ] Error page shows on failures
- [ ] Server logs every stage with timings
- [ ] Profile created in database
- [ ] Cookie set correctly
- [ ] Redirects to correct dashboard
- [ ] Email auth unchanged
- [ ] Multiple roles handled
- [ ] Refresh during callback is safe
- [ ] No duplicate profiles on retry
- [ ] Production error rate <1%
- [ ] User feedback positive on speed
