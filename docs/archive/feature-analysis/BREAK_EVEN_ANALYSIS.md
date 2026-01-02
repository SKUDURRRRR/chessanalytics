# Break-Even Analysis: $50/Year Unlimited Plan

**Date:** January 2025
**Question:** How many games can a player import and analyze before I lose money on a $50/year unlimited plan?

---

## Executive Summary

**Short Answer:** You essentially **cannot lose money** from a single customer's usage on the $50/year plan. The infrastructure runs 24/7 at a fixed cost ($24.30/month), and the variable cost per game analysis is **negligible** (less than $0.0001 per game).

**However**, you need **at least 6 customers** to break even on infrastructure costs.

---

## Cost Structure

### Fixed Costs (Infrastructure - Runs 24/7)

| Item | Cost/Day | Cost/Month |
|------|----------|------------|
| Railway Pro (Memory baseline 400 MB) | $0.22 | $6.60 |
| Railway Pro (Memory peak spikes) | $0.11 | $3.30 |
| Railway Pro (CPU average 0.4 vCPU) | $0.44 | $13.20 |
| Railway Pro (Egress) | $0.04 | $1.20 |
| **TOTAL FIXED COST** | **$0.81** | **$24.30** |

**Key Point:** This cost runs **regardless of usage**. Your server is running 24/7 whether customers analyze games or not.

### Variable Costs Per Game Analysis

| Item | Cost per Game Analysis |
|------|----------------------|
| CPU time (8 seconds @ 0.4 vCPU) | ~$0.000001 |
| Memory spike (200 MB for 8 seconds) | ~$0.0000001 |
| Database storage (per game) | ~$0.000001 (negligible) |
| **TOTAL PER GAME** | **~$0.000002** |

**Conclusion:** Variable costs are essentially **$0** per game analysis.

---

## Break-Even Analysis

### Revenue per Customer
- **Yearly plan:** $50/year = **$4.17/month**

### Minimum Customers Needed
- **Break-even point:** $24.30 (monthly cost) ÷ $4.17 (revenue per customer) = **5.8 customers**
- **Minimum:** **6 customers** to cover infrastructure costs

### Maximum Usage Scenario (Single Customer)

**Question:** Can one customer analyze so many games that it forces infrastructure scaling?

**Current Capacity (from CAPACITY_ANALYSIS.md):**
- System can handle **10-20 concurrent users** comfortably
- Each game analysis takes **5-8 seconds**
- System can process **~4 concurrent analyses**

**Maximum Games Per Day (Single User):**
- If user analyzes games continuously (24/7):
  - 4 concurrent analyses × 8 seconds = 32 seconds per batch
  - 24 hours × 3600 seconds = 86,400 seconds/day
  - 86,400 ÷ 32 = **2,700 batches/day**
  - With 4 games per batch ≈ **10,800 games/day**

**Realistic Maximum (Single Heavy User):**
- Most users analyze in bursts, not continuously
- Realistic max: **1,000-2,000 games/day** per user
- This is well within system capacity

**Cost Impact:**
- Even at 2,000 games/day = 60,000 games/month
- Variable cost: 60,000 × $0.000002 = **$0.12/month** (essentially free)

---

## Answer to Your Question

### "How many games can a player import and analyze for me to lose money?"

**Answer:** You **cannot lose money** from a single customer's game analysis usage because:

1. **Fixed costs are fixed:** Your $24.30/month infrastructure cost runs regardless of usage
2. **Variable costs are negligible:** Each game analysis costs ~$0.000002 (essentially free)
3. **One customer can't break the system:** Even analyzing 2,000 games/day, the cost is $0.12/month

### The Real Break-Even Point

You need **6 customers** to break even:
- 6 customers × $4.17/month = $25.02/month
- Infrastructure cost = $24.30/month
- **Profit:** $0.72/month (essentially break-even)

### When You'd Actually Lose Money

You'd only lose money if:
1. **You have fewer than 6 paying customers** (fixed costs aren't covered)
2. **A single customer's usage forces infrastructure scaling** (unlikely - would need 10,000+ games/day)
3. **Database storage exceeds Supabase limits** (Supabase Free: 500 MB, Pro: 8 GB included)

---

## Risk Scenarios

### Scenario 1: Single Heavy User (2,000 games/day)
- **Cost impact:** $0.12/month (negligible)
- **Infrastructure impact:** Minimal (within capacity)
- **Verdict:** ✅ No problem

### Scenario 2: Multiple Heavy Users (10 users × 1,000 games/day)
- **Total:** 10,000 games/day
- **Cost impact:** $0.60/month (still negligible)
- **Infrastructure impact:** System can handle 10-20 concurrent users
- **Verdict:** ✅ Still manageable

### Scenario 3: Database Storage
- **Per game storage:** ~5-10 KB (game record + PGN + analysis)
- **10,000 games:** ~50-100 MB
- **Supabase Free tier:** 500 MB included
- **Supabase Pro tier:** 8 GB included ($25/month)
- **Verdict:** ✅ Storage not a concern for reasonable usage

### Scenario 4: Infrastructure Scaling Required
- **Trigger:** If you have 50+ concurrent heavy users
- **Cost:** Would need to upgrade infrastructure (+$20-40/month)
- **Unlikely:** Would require 50+ customers on unlimited plans
- **Verdict:** ⚠️ Only a problem if you have 50+ paying customers (good problem to have!)

---

## Recommendations

### For Current Pricing ($50/year)

1. **✅ Pricing is safe:** You cannot lose money from individual customer usage
2. **Minimum customers:** Need 6 customers to break even on infrastructure
3. **Profit margin:** Each customer beyond 6 adds ~$4/month profit (after fixed costs)

### If You Want to Be More Conservative

Consider adding:
- **Fair use policy:** Limit to 10,000 games/month per user (still very generous)
- **Rate limiting:** Max 100 games/hour per user (prevents abuse)
- **Priority queue:** Unlimited users get priority, but system can handle it

### Monitoring

Track:
- **Number of paying customers** (need 6+ to break even)
- **Database storage usage** (Supabase limits)
- **Concurrent user count** (system capacity)
- **Infrastructure costs** (Railway billing)

---

## Conclusion

**You cannot lose money from a single customer's game analysis usage** because:
1. Infrastructure costs are fixed ($24.30/month)
2. Variable costs per game are essentially $0
3. System capacity can handle even extreme usage

**The real question is:** Do you have enough customers to cover your fixed costs?

- **Break-even:** 6 customers
- **Profitable:** 7+ customers
- **Each additional customer:** Adds ~$4/month profit

**Bottom Line:** Your $50/year unlimited plan is financially safe. The unlimited usage won't cause you to lose money - you just need enough customers to cover the fixed infrastructure costs.
