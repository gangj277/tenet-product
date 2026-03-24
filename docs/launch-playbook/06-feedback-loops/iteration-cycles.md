# Iteration Cycles

> Sprint cadence for beta development — what to build, when, and how.

---

## Philosophy

During the 12-week CBT, you are not building a product. You are **learning** what the product should be. Every sprint should answer a question, not just ship a feature.

```
Question → Hypothesis → Build/Test → Measure → Learn → Next Question
```

---

## Sprint Structure: 2-Week Cycles

### Why 2 Weeks
- 1 week is too short to build anything meaningful
- 3+ weeks loses momentum with beta testers (they forget what changed)
- 2 weeks = 6 cycles in 12 weeks = enough iterations to find PMF

### Sprint Calendar

```
Day 1 (Monday):    Sprint planning — review feedback, set 1-2 goals
Day 2-4:           Build
Day 5 (Friday):    Internal review — does it solve the question?
Day 6-8:           Build + polish
Day 9 (Tuesday):   Ship to Founding Researchers
Day 10 (Wednesday): Announce in Discord #changelog
Day 11-12:         Observe usage + collect feedback
Day 13 (Friday):   Sprint retrospective — what did we learn?
Day 14 (Weekend):  Rest. Process. Prepare next sprint.
```

---

## The 6 Sprints of CBT

### Sprint 1 (Weeks 1-2): "Does the Core Pipeline Deliver Value?"

**Question**: When researchers run their first project, does the output feel useful?

**Focus**:
- Onboarding smoothness (first project completion rate)
- Quality of synthesis output
- Fix critical bugs from first week of use

**Metrics**:
- % of researchers who complete a project in week 1
- Usefulness rating from first feedback form (target: 3.5+/5)
- # of bugs reported and fixed

**Exit criteria**: 80%+ researchers complete at least one project

### Sprint 2 (Weeks 3-4): "What Artifact Matters Most?"

**Question**: Which artifact (overview, synthesis, claims, gaps, next-steps) do researchers actually use and value?

**Focus**:
- Track which artifacts researchers open, read, and edit
- Ask specifically about artifact value in feedback form
- Improve the highest-value artifact based on feedback

**Metrics**:
- Artifact view/edit frequency
- "Most valuable artifact" survey results
- Qualitative feedback on each artifact

**Exit criteria**: Clear signal on which 1-2 artifacts are essential

### Sprint 3 (Weeks 5-6): "Does the Agent Add Value?"

**Question**: Do researchers use the workspace agent, and does it help?

**Focus**:
- Agent usage frequency and patterns
- Slash command adoption
- Quality of agent responses and proposed updates
- Accept/reject rate on inline diffs

**Metrics**:
- % of researchers who use agent 2+ times per week
- Most-used slash commands
- Diff accept rate (target: 60%+)

**Exit criteria**: Clear signal on whether agent is core value or nice-to-have

### Sprint 4 (Weeks 7-8): "What's Missing?"

**Question**: What do researchers need that Lumen doesn't do yet?

**Focus**:
- Feature requests ranked by frequency
- Workflow gaps (where do researchers leave Lumen to use another tool?)
- Build the #1 most-requested feature

**Metrics**:
- Feature request frequency ranking
- "What's the one thing..." survey responses
- Usage of newly shipped feature

**Exit criteria**: Ship 1-2 features that address top feedback themes

### Sprint 5 (Weeks 9-10): "Would They Pay?"

**Question**: Is the value strong enough that researchers would pay or feel loss if it disappeared?

**Focus**:
- Run the Sean Ellis PMF test (see [Feedback Framework](./feedback-framework.md))
- Conduct deep feedback interviews
- Identify the "magic moment" — what specific experience makes a researcher become a lover
- Begin collecting testimonials

**Metrics**:
- % "very disappointed" if Lumen disappeared (target: 40%+)
- NPS score (target: 50+)
- # of organic referrals (researchers who invited colleagues unprompted)

**Exit criteria**: PMF signal strong enough to justify public launch

### Sprint 6 (Weeks 11-12): "Ready for Public?"

**Question**: Is the product stable, valuable, and explainable enough for a public launch?

**Focus**:
- Stability and performance hardening
- Onboarding flow optimization (based on 10 weeks of data)
- Landing page and positioning refinement
- Prepare for Product Hunt / public launch

**Metrics**:
- Bug count (target: zero critical, <5 minor)
- Onboarding completion rate (target: 90%+)
- Researcher retention (active in week 11-12 / started week 1-2)

**Exit criteria**: Green light for public launch planning

---

## Sprint Planning Template

Use this for each sprint:

```
Sprint [#]: [Name]
Dates: [Start] — [End]

QUESTION:
What are we trying to learn?

HYPOTHESIS:
What do we believe the answer is?

BUILD:
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

MEASURE:
- Metric 1: ___
- Metric 2: ___
- Qualitative signal: ___

SHIP DATE: [Date]

RETROSPECTIVE:
What did we learn?
What surprised us?
What should we do differently next sprint?
```

---

## Decision Framework: Build vs. Wait

When a feature request comes in, run it through this filter:

```
                    ┌── Does it address the current sprint question?
                    │
                    ├── YES → Is it < 2 days of work?
                    │            ├── YES → Build it this sprint
                    │            └── NO  → Scope down or defer to next sprint
                    │
                    └── NO  → Is it a critical bug or churn risk?
                                 ├── YES → Fix immediately (interrupt sprint)
                                 └── NO  → Add to backlog, rank by frequency
```

### Backlog Ranking

| Rank | Criteria |
|------|----------|
| P0 | Critical bug blocking researchers from using core features |
| P1 | Requested by 5+ researchers AND aligns with sprint question |
| P2 | Requested by 3+ researchers OR addresses identified churn risk |
| P3 | Requested by 1-2 researchers, interesting but not urgent |
| P4 | Cool idea, no current demand |

---

## What NOT to Build During CBT

| Temptation | Why Not | When to Build It |
|-----------|---------|-----------------|
| Pricing / billing system | No one is paying yet. Don't add complexity | After PMF confirmed (Sprint 5+) |
| Team / collaboration features | Single-researcher use case isn't proven yet | After proving solo value |
| Mobile app | Desktop/web is the primary use case for researchers | After public launch if demand exists |
| Admin dashboard | You have 50 users. A spreadsheet works | When you have 500+ |
| SEO / marketing pages | You're not acquiring from search yet | Before public launch |
| Integrations (Zotero, Mendeley) | Nice-to-have, not core value driver | After core synthesis is proven |
