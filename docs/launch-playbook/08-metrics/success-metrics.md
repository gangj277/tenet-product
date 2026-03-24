# Success Metrics

> What to measure, what the targets are, and when to celebrate (or worry).

---

## North Star Metric

**Weekly Active Researchers (WAR)**: Number of Founding Researchers who used Lumen for real research in the past 7 days.

This is the single number that matters most during CBT. Everything else is a supporting signal.

**Target trajectory:**
- Week 2: 20+ WAR (out of 30-50 accepted)
- Week 6: 25+ WAR
- Week 10: 20+ WAR (some natural drop-off is OK)
- Week 12: 15+ WAR (core lovers still active)

---

## Metric Categories

### 1. Activation Metrics (Weeks 1-3)

| Metric | Definition | Target | Red Flag |
|--------|-----------|--------|----------|
| Application-to-accept rate | Accepted / Applied | 50-70% | < 30% (quality issue with channel) |
| Time to first login | Hours from welcome email to first login | < 48 hours | > 7 days |
| First project completion rate | % who complete a full project | 80%+ | < 50% |
| Time to first project | Hours from first login to completed project | < 2 hours | > 7 days |
| Agent interaction rate | % who use the workspace agent | 60%+ | < 30% |

### 2. Engagement Metrics (Weeks 3-10)

| Metric | Definition | Target | Red Flag |
|--------|-----------|--------|----------|
| Weekly Active Researchers | Used Lumen in past 7 days | 60%+ of cohort | < 40% |
| Projects per researcher | Total projects / Total researchers | 2+ by week 6 | < 1 average |
| Agent queries per week | Total agent interactions / Active researchers | 3+ per researcher | < 1 |
| Feedback form completion | % who submit weekly form | 70%+ | < 40% |
| Discord activity | Messages per week from researchers | Healthy discussion | Ghost town |
| Return rate | % who use Lumen in consecutive weeks | 50%+ | < 30% |

### 3. Value Metrics (Weeks 5-12)

| Metric | Definition | Target | Red Flag |
|--------|-----------|--------|----------|
| Usefulness rating | Average weekly rating (1-5) | 4.0+ | < 3.0 |
| "Very disappointed" (PMF) | % who'd be very disappointed without Lumen | 40%+ | < 25% |
| NPS | Net Promoter Score | 50+ | < 20 |
| Organic referrals | Researchers who invite colleagues unprompted | 5+ | 0 |
| "Found something I'd have missed" | % who report this | 50%+ | < 20% |
| Testimonial willingness | % willing to give testimonial | 60%+ | < 30% |

### 4. Product Health Metrics (Ongoing)

| Metric | Definition | Target | Red Flag |
|--------|-----------|--------|----------|
| Critical bugs | Show-stopping bugs reported | 0 | Any unresolved > 48 hours |
| Pipeline success rate | % of projects that complete without error | 95%+ | < 85% |
| Pipeline completion time | Minutes from start to synthesis | < 5 min | > 10 min |
| Diff accept rate | Agent proposed updates accepted / total | 60%+ | < 30% |
| Evidence accuracy | Researcher-reported accuracy of claims | High | Pattern of inaccuracy complaints |

---

## The PMF Dashboard

Track these 4 numbers weekly. They tell the PMF story:

```
┌──────────────────────────────────────────────┐
│  LUMEN CBT — WEEK [N] PMF DASHBOARD          │
│                                              │
│  WAR:        [X] / [Total]  ([%])            │
│  Usefulness: [X.X] / 5.0                     │
│  PMF Score:  [X]% "very disappointed"        │
│  NPS:        [X]                              │
│                                              │
│  Trend: ↑ ↓ → (compared to last week)        │
└──────────────────────────────────────────────┘
```

---

## Cohort Health Check (Run Weekly)

### Green (Healthy)
- 60%+ WAR
- Usefulness 4.0+
- Feedback form completion 70%+
- Active Discord discussion
- Bugs reported AND fixed within 48 hours

### Yellow (Watch Closely)
- 40-60% WAR
- Usefulness 3.0-4.0
- Feedback form completion 40-70%
- Discord quiet but not dead
- Some unresolved bugs lingering

### Red (Intervention Needed)
- < 40% WAR
- Usefulness < 3.0
- Feedback form completion < 40%
- Discord inactive
- Critical bugs unresolved > 48 hours
- Multiple researchers stop using Lumen without explanation

### Red Flag Actions
1. **Personal outreach** to every inactive researcher within 24 hours
2. **Emergency feedback round** — "What went wrong? What would bring you back?"
3. **Pause new features** — focus entirely on fixing the core experience
4. **Consider pivoting** the sprint focus to address the root cause

---

## Graduation Criteria (End of Week 12)

### Ready for Public Launch (All Must Be True)

| Criterion | Threshold | Status |
|-----------|-----------|--------|
| PMF score ("very disappointed") | 40%+ | [ ] |
| Active researchers in final week | 15+ (out of 30-50) | [ ] |
| Usefulness rating (final week) | 4.0+ / 5.0 | [ ] |
| NPS | 50+ | [ ] |
| Willing testimonials collected | 10+ | [ ] |
| Critical bugs | 0 | [ ] |
| Pipeline success rate | 95%+ | [ ] |
| Organic referrals received | 5+ | [ ] |

### Not Ready Yet (Run Cohort 2)

If any of these are true:
- PMF score < 30%
- Fewer than 10 active researchers in final weeks
- Usefulness rating < 3.5
- Core pipeline failures > 5%
- No organic referrals

**This is not failure.** It means you learned what needs to change before going public. Run a second cohort with the improvements.

---

## Tracking Tools

Keep it simple during CBT:

| What | Tool | Why |
|------|------|-----|
| Cohort tracker | Google Sheets | Simple, shareable, no setup |
| Feedback forms | Google Forms or Typeform | Free, easy to analyze |
| Bug tracking | Discord #bugs channel + spreadsheet | Researchers already in Discord |
| PMF dashboard | Spreadsheet with weekly update | Manual is fine for 50 people |
| Usage analytics | Basic event logging in your app | Build only what you need to track the metrics above |

**Do NOT invest in analytics infrastructure during CBT.** A spreadsheet updated weekly is sufficient for 30-50 researchers. Build analytics tooling if/when you prepare for public launch.
