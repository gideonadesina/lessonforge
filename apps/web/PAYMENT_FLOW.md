/**
 * LESSONFORGE TEACHER PAYMENT FLOW - COMPLETE GUIDE
 * 
 * This document explains the idempotent payment processing system for teacher credit purchases.
 * 
 * ========================================
 * KEY PRINCIPLES
 * ========================================
 * 
 * 1. IDEMPOTENCY: Same payment reference can only grant credits once
 * 2. SAFE INCREMENT: Credits always add to existing balance, never overwrite
 * 3. ATOMIC UPDATES: Compare-and-swap prevents race conditions
 * 4. DUAL-PATH: Works if verify runs first OR webhook runs first, or both
 * 5. AUDIT TRAIL: Every payment recorded in teacher_payment_transactions
 * 
 * ========================================
 * TEST SCENARIO: User Purchases Pro Plan
 * ========================================
 * 
 * GIVEN:
 * - Teacher has 8 credits (new user)
 * - Purchases Pro plan for ₦5,000 = 30 credits
 * - Paystack reference: "pay_abc123def456"
 * 
 * ========================================
 * STEP 1: Initialize Payment (Client)
 * ========================================
 * 
 * POST /api/paystack/initialize
 * {
 *   "plan": "pro",
 *   "currency": "NGN"
 * }
 * 
 * BACKEND:
 * 1. Validate plan is valid ("pro" is legit)
 * 2. Get pricing from server-pricing.ts config:
 *    - Pro plan: 5000 NGN = 500000 kobo (in Paystack minor units)
 *    - Credits: 30
 * 3. Create Paystack transaction with metadata:
 *    {
 *      "user_id": "user_xyz",
 *      "plan": "pro",
 *      "credits": 30
 *    }
 * 4. Return authorization URL to client
 * 
 * RESULT: Reference "pay_abc123def456" issued by Paystack
 * 
 * ========================================
 * STEP 2a: Verify Payment (API Route - if user clicks verify)
 * ========================================
 * 
 * GET /api/paystack/verify?reference=pay_abc123def456
 * 
 * FLOW:
 * 1. Extract reference from URL: "pay_abc123def456"
 * 2. Call Paystack API to verify payment
 * 3. Paystack returns: { status: "success", amount: 500000, metadata: {...} }
 * 
 * 4. Process payment with idempotency:
 *    processTeacherPayment({
 *      reference: "pay_abc123def456",
 *      userId: "user_xyz",
 *      plan: "pro",
 *      amount: 500000,
 *      currency: "NGN",
 *      ...
 *    })
 * 
 * INSIDE processTeacherPayment:
 * 
 *    a) Record the payment transaction (idempotent insert):
 *       - Check if "pay_abc123def456" already in teacher_payment_transactions
 *       - If NOT found, INSERT new record with processed=false
 *       - If FOUND, return existing record status
 * 
 *    b) If already processed (processed=true):
 *       - Return early with "alreadyProcessed: true"
 *       - Credits already granted, do nothing
 * 
 *    c) If new or not yet marked processed:
 *       - Call grantCreditsForPayment()
 * 
 * INSIDE grantCreditsForPayment:
 * 
 *    i)   Get current balance: 8 credits
 *    ii)  Get credits for "pro" plan from server-pricing: 30
 *    iii) Atomic increment (compare-and-swap loop):
 *         SELECT credits_balance WHERE id="user_xyz" -> 8
 *         UPDATE credits_balance = 8 + 30 = 38 
 *         WHERE id="user_xyz" AND credits_balance=8
 *         -> SUCCESS, new balance is 38
 *    iv)  Mark transaction processed:
 *         UPDATE teacher_payment_transactions
 *         SET processed=true, processed_at=NOW()
 *         WHERE reference="pay_abc123def456"
 * 
 * 5. Update profile metadata (plan, expiry):
 *    UPDATE profiles
 *    SET plan="pro", 
 *        is_pro=true,
 *        pro_expires_at=NOW() + 30 days,
 *        paystack_customer_code="cus_xyz",
 *        ...
 *    WHERE id="user_xyz"
 * 
 * RESPONSE:
 * {
 *   "ok": true,
 *   "reference": "pay_abc123def456",
 *   "plan": "pro",
 *   "creditsAwarded": 30,
 *   "previousBalance": 8,
 *   "newBalance": 38,
 *   "alreadyProcessed": false
 * }
 * 
 * ========================================
 * STEP 2b: Webhook Payment Processing
 *          (Runs in parallel or instead of verify)
 * ========================================
 * 
 * Paystack sends POST /api/paystack/webhook
 * {
 *   "event": "charge.success",
 *   "data": {
 *     "reference": "pay_abc123def456",
 *     "status": "success",
 *     "amount": 500000,
 *     "currency": "NGN",
 *     "metadata": {
 *       "user_id": "user_xyz",
 *       "plan": "pro"
 *     },
 *     ...
 *   }
 * }
 * 
 * FLOW:
 * 1. Verify Paystack signature (prevents spoofing)
 * 2. Extract reference, userId, plan
 * 3. Call processTeacherPayment() - SAME AS VERIFY ROUTE
 * 
 * IDENTICAL LOGIC:
 * - Check if reference already processed
 * - If already processed, return 200 with "alreadyProcessed: true"
 * - If new, grant credits and mark processed
 * - Update profile metadata
 * 
 * KEY DIFFERENCE: Always returns HTTP 200 (webhook ack)
 * 
 * ========================================
 * SCENARIO VARIATIONS
 * ========================================
 * 
 * NORMAL PATH (verify runs first):
 * 1. Verify endpoint processes -> credits granted, transaction marked processed
 * 2. Webhook arrives later -> sees processed=true, returns without double-crediting
 * Result: 38 credits ✅
 * 
 * WEBHOOK FIRST PATH:
 * 1. Webhook arrives first -> processes, credits granted, marked processed
 * 2. User clicks verify -> sees processed=true, returns without double-crediting
 * Result: 38 credits ✅
 * 
 * DUPLICATE VERIFY (user refreshes payment page):
 * 1. First verify -> credits granted (8 + 30 = 38), marked processed
 * 2. Second verify same reference -> payment already processed, no change
 * Result: 38 credits (not 68!) ✅
 * 
 * VERIFY + WEBHOOK (both run):
 * 1. Verify at T1 -> credits granted (8 + 30 = 38), marked processed
 * 2. Webhook at T2 -> finds processed=true, returns early
 * Result: 38 credits (not 68!) ✅
 * 
 * CONCURRENT VERIFY CALLS (rare race):
 * 1. Verify 1 starts (T0) -> checks reference, doesn't exist -> INSERT
 * 2. Verify 2 starts (T0) -> checks reference, doesn't exist -> INSERT (fails, unique key)
 * 3. Verify 2 retries -> finds processed=false -> grants credits
 * Result: 38 credits ✅
 * 
 * ========================================
 * DATA CONSISTENCY CHECKS
 * ========================================
 * 
 * After payment completes, teacher has:
 * 
 * profiles.credits_balance = 38
 * profiles.plan = "pro"
 * profiles.is_pro = true
 * profiles.pro_expires_at = 2026-04-29T12:34:56Z
 * 
 * teacher_payment_transactions:
 * {
 *   reference: "pay_abc123def456",
 *   user_id: "user_xyz",
 *   plan: "pro",
 *   amount: 500000,
 *   currency: "NGN",
 *   processed: true,
 *   processed_at: 2026-03-30T12:34:56Z,
 *   credits_awarded: 30,
 *   credits_awarded_at: 2026-03-30T12:34:56Z
 * }
 * 
 * ========================================
 * FAILURE SCENARIOS & RECOVERY
 * ========================================
 * 
 * SCENARIO 1: Webhook fails after credit grant
 * - Payment recorded with processed=true
 * - Credits were already granted
 * - Next webhook attempt -> sees processed=true, returns early
 * - No data loss ✅
 * 
 * SCENARIO 2: Database timeout during credit increment
 * - Compare-and-swap fails
 * - grantCreditsForPayment throws error
 * - processTeacherPayment returns ok=false
 * - Transaction NOT marked processed
 * - Next attempt will retry and succeed ✅
 * 
 * SCENARIO 3: Verify succeeds but webhook never arrives
 * - Credits granted via verify endpoint
 * - Payment marked as processed
 * - Teacher has full credits ✅
 * 
 * ========================================
 * IMPORTANT: DO NOT RELY ON PAYMENT STATUS
 * ========================================
 * 
 * The "processed" flag in teacher_payment_transactions is the SOURCE OF TRUTH.
 * Not the Paystack status (which cannot change after success).
 * 
 * This ensures:
 * - Exactly-once credit grant
 * - No accidental double-crediting
 * - Clean audit trail
 * 
 * ========================================
 * MONITORING & DEBUGGING
 * ========================================
 * 
 * To find payment issues:
 * 
 * 1. Check transaction record:
 *    SELECT * FROM teacher_payment_transactions 
 *    WHERE reference='pay_abc123def456'
 * 
 * 2. Verify credit balance:
 *    SELECT credits_balance FROM profiles WHERE id='user_xyz'
 * 
 * 3. Check logs:
 *    - Verify endpoint logs
 *    - Webhook processing logs (see processTeacherPayment)
 * 
 * 4. If credits stuck:
 *    - Check processed flag (false = not yet granted)
 *    - Run manual retry by calling verify endpoint again
 */
