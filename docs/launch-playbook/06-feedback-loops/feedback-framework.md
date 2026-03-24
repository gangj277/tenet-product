# Feedback Framework

> How to collect, categorize, and act on Founding Researcher feedback.

---

## Three Feedback Channels

| Channel | Type | Frequency | Purpose |
|---------|------|-----------|---------|
| Weekly feedback form | Structured | Weekly (Monday) | Quantitative signal + rotating qualitative topics |
| Discord channels | Unstructured | Ongoing | Real-time reactions, bugs, ideas |
| Feedback interviews | Deep | Once per researcher (weeks 9-10) | Rich qualitative understanding |

---

## Weekly Feedback Form (5 Questions, Rotating)

### Core Questions (Every Week)

```
1. How many times did you use Lumen this week?
   [ ] 0  [ ] 1-2  [ ] 3-5  [ ] 6+

2. On a scale of 1-5, how useful was Lumen for your research this week?
   1 (Not useful) ← → 5 (Very useful)

3. Did you encounter any bugs or confusing moments? (Brief description)
   [Text field]
```

### Rotating Questions (Pick 2 per week, cycle through)

**Product-Market Fit:**
```
- "How would you feel if you could no longer use Lumen?"
  [ ] Very disappointed  [ ] Somewhat disappointed  [ ] Not disappointed

- "Would you recommend Lumen to a colleague working on a lit review?"
  [ ] Definitely  [ ] Probably  [ ] Probably not  [ ] Definitely not

- "What type of researcher would benefit most from Lumen?"
  [Text field]
```

**Feature Value:**
```
- "Which artifact do you find most valuable?"
  [ ] Overview  [ ] Synthesis  [ ] Claims  [ ] Gaps  [ ] Next Steps

- "Have you used the workspace agent this week? For what?"
  [Text field]

- "Which slash command skill do you use most?"
  [ ] /devils-advocate  [ ] /methodology-critic  [ ] /paper-explainer
  [ ] /synthesis-updater  [ ] None yet
```

**Workflow:**
```
- "What tool did Lumen replace or complement in your workflow this week?"
  [Text field]

- "What's the one thing you still do manually that Lumen should handle?"
  [Text field]

- "Describe one moment this week where Lumen saved you time or
   helped you see something new."
  [Text field]
```

**Pain Points:**
```
- "What's the most frustrating part of using Lumen right now?"
  [Text field]

- "If you could change one thing about Lumen, what would it be?"
  [Text field]

- "Did you abandon a task in Lumen this week? What happened?"
  [Text field]
```

---

## Feedback Interview Guide (30 Minutes)

### Schedule
- Weeks 9-10 of the 12-week program
- 30 minutes per researcher
- Video call (Zoom/Google Meet)
- Record with permission for internal review

### Question Flow

**Opening (2 min)**
```
"Thanks for joining. I want to understand your experience — what works,
what doesn't, and what you wish Lumen did. There are no wrong answers.
Honest criticism is the most valuable thing you can give me."
```

**Workflow Context (5 min)**
```
1. "Walk me through how you used Lumen in the past few weeks.
    What was your research question?"

2. "How does Lumen fit into your broader research workflow?
    What do you use before and after Lumen?"
```

**Value Discovery (8 min)**
```
3. "What's the most valuable thing Lumen has done for your research?"

4. "Has Lumen helped you discover something you would have missed
    otherwise? What was it?"

5. "If Lumen disappeared tomorrow, what would you miss most?"
```

**Pain Point Discovery (8 min)**
```
6. "What's been the most frustrating experience with Lumen?"

7. "Was there a moment where you expected Lumen to do something and
    it didn't? Walk me through it."

8. "What's the #1 thing that would make Lumen significantly more
    useful for your work?"
```

**Product Direction (5 min)**
```
9. "If you could design the next big feature, what would it be?"

10. "Who else should be using Lumen? What kind of researcher?"
```

**Closing (2 min)**
```
11. "On a scale of 0-10, how likely are you to recommend Lumen to
     a colleague? Why that number?"

12. "Anything else you want to share that I didn't ask about?"
```

---

## Feedback Categorization

### Taxonomy

Categorize all feedback (forms + Discord + interviews) into:

| Category | Code | Description | Action |
|----------|------|-------------|--------|
| Bug | BUG | Something broke or errored | Fix immediately if blocking, else backlog |
| UX Friction | UXF | Confusing, slow, or unintuitive interaction | Prioritize if 3+ researchers report it |
| Feature Request | FR | New capability they want | Log and rank by frequency |
| Value Signal | VAL+ | Something they loved or found uniquely useful | Document for positioning and marketing |
| Churn Risk | CHURN | Frustration, disengagement, or "I stopped using it" signal | Personal outreach within 24 hours |
| Workflow Insight | WF | How they actually use the tool (vs. how we designed it) | Inform product decisions |
| Competitive Intel | COMP | Mentions of other tools, comparisons, switching | Track patterns |

### Feedback Log Template

| Date | Researcher | Channel | Category | Verbatim Quote | Action Taken | Status |
|------|-----------|---------|----------|----------------|-------------|--------|
| | | | | | | |

---

## The Sean Ellis PMF Test

Track the "very disappointed" metric weekly:

```
"How would you feel if you could no longer use Lumen?"
[ ] Very disappointed
[ ] Somewhat disappointed
[ ] Not disappointed
```

### Benchmarks

| % "Very Disappointed" | What It Means | Action |
|----------------------|---------------|--------|
| 40%+ | Strong product-market fit signal | Prepare for public launch |
| 25-39% | Getting there — iterate on value delivery | Focus on the "very disappointed" segment — what do they love? |
| < 25% | Not yet — product isn't essential to anyone | Deep-dive: what's missing? Consider pivot or repositioning |

**Target**: 40%+ by end of 12-week program.

---

## Closing the Loop

The #1 rule of beta feedback: **always show them what you did with their feedback.**

### Weekly (Discord #changelog)
```
Based on your feedback this week:
- [Researcher A] reported [issue] → Fixed in today's release
- [Researcher B] requested [feature] → Shipping next week
- Several of you mentioned [pattern] → We're exploring this
```

### Monthly (Email)
```
Subject: What you helped us build this month

Hi [First name],

This month, the Founding Researcher cohort submitted [X] pieces
of feedback. Here's what changed because of you:

Built: [Feature or fix inspired by feedback]
Improved: [Enhancement based on usage patterns]
Decided against: [Something we chose not to build, and why]
Coming next: [What's on the roadmap]

Your feedback on [their specific contribution] directly influenced
[specific change].

Thank you for helping build this.

[Your name]
```

---

## Anti-Patterns

| Don't Do This | Why | Do This Instead |
|--------------|-----|----------------|
| Collect feedback but never act on it | Researchers stop giving feedback | Close the loop every week |
| Only ask about bugs | Misses value signals and workflow insights | Use the full taxonomy |
| React to every request by building it | Unfocused product | Rank by frequency and alignment with vision |
| Ignore quiet researchers | They may be churning silently | Proactive check-in after 2 weeks of silence |
| Average all feedback equally | Not all researchers represent your target | Weight feedback by engagement level and segment fit |
