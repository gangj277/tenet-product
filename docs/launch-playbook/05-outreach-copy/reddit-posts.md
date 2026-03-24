# Reddit Posts (Ready-to-Use)

> Platform-native posts for each target subreddit. Adapt tone per community.

---

## Pre-Launch Warmup Posts (Week 1-3, Before Mentioning Lumen)

These posts build credibility and karma. No mention of Lumen.

### r/PhD — Workflow Discussion Post

```
Title: Those of you doing systematic reviews — what's your actual workflow?

I'm curious how people handle the synthesis part of literature reviews.
Not the finding papers part (Elicit, Scholar, etc.) — the part where you
have 30+ papers and need to actually figure out what the evidence says.

Specifically:
- How do you track contradictions between papers?
- How do you decide which claims are well-supported vs. weak?
- How do you organize your notes so you can actually write from them?

I've been struggling with this and trying to build a better system.
Would love to hear what's working for others.
```

### r/GradSchool — Pain Point Post

```
Title: The gap between "I've read everything" and "I know what the evidence says"

Anyone else feel this? You spend weeks reading papers for your lit review.
You have notes everywhere. You can summarize individual papers fine. But
when someone asks "so what does the evidence actually say?" you freeze.

The synthesis step — going from individual paper knowledge to structured
understanding — feels like the hardest part of research and there are
almost no tools designed specifically for it.

What do you all do at this point? Just stare at your notes until it
clicks?
```

---

## Recruitment Posts (Week 4+, After Warmup)

### r/PhD — Founding Researcher Recruitment

```
Title: I built an AI research workspace for evidence synthesis — looking
for PhD researchers to help shape it (free lifetime access)

I've been working on a tool called Lumen for the past several months.
The short version: you give it a research question + papers, and it
produces structured synthesis — with every claim traced to a source,
contradictions explicitly surfaced, and gaps identified.

It's NOT another "AI summarizer." The core idea is structured judgment:
claims maps, evidence confidence levels, methodology assessment. You
can then refine everything through a workspace agent that understands
your evidence base.

I'm looking for 30-50 PhD students and researchers to be "Founding
Researchers" — help shape the tool by using it for real research.

What you'd get:
- Lifetime free access to Lumen
- Direct input into what we build
- "Founding Researcher" recognition

What I'd ask:
- Use it for at least one real research project
- Fill out a short feedback form weekly (5 min)
- Tell me what's broken, what's useful, and what's missing

If you're currently working on a literature review or systematic review,
this is designed for exactly your workflow.

Application form: [link]

Happy to answer any questions here. I'm the builder, not a marketing
person, so ask me anything about how it works.
```

### r/SystematicReviews — Direct Value Post

```
Title: Tool for structured evidence synthesis — looking for systematic
review authors to test it

I built Lumen because I was frustrated watching researchers spend months
on the extraction and synthesis phases of systematic reviews.

What it does:
- Ingests papers (upload PDFs or auto-discover from OpenAlex/Semantic
  Scholar/arXiv)
- Extracts evidence items tagged by type (supporting, contradictory,
  methodological) and confidence level
- Surfaces contradictions between sources explicitly
- Produces structured outputs: claims map, evidence gaps, methodology
  assessment, next steps

It's built for researchers who need every claim traceable to a specific
source, page, and quote. Not vague AI summaries.

I'm running a closed beta with 30-50 researchers. If you're working on
a systematic review and want to try it (free, forever), here's the
application: [link]

I'm here to answer technical questions about how the synthesis works.
```

### r/MachineLearning — Technical Angle Post

```
Title: Built a LangGraph-based research synthesis pipeline — looking
for ML researchers to stress-test it

I've been building Lumen, an AI workspace for evidence-grounded research
synthesis. The technical core is a 9-node LangGraph pipeline:

1. Intake + perspective inference
2. MECE query planning across OpenAlex/Semantic Scholar/arXiv
3. Parallel source ingestion + Gemini-based PDF extraction
4. Multi-persona evidence analysis (analytical, skeptical, methodology-
   focused perspectives)
5. Contradiction surfacing + evidence confidence mapping
6. Structured artifact generation (claims, gaps, next-steps)

The workspace includes a ReAct agent with tools for reading, searching,
and editing synthesis files — with inline diff proposals.

I'm looking for ML researchers to use it for real literature surveys and
tell me where the synthesis breaks down. Especially interested in how it
handles:
- Highly technical papers with mathematical notation
- Fast-moving fields with lots of preprints
- Papers that make similar claims with different methodologies

Free lifetime access for participants: [application link]

Happy to discuss the architecture if anyone's interested.
```

### r/AskAcademia — Value-First Question

```
Title: Researchers who use AI tools — what's missing from current
options like Elicit, Consensus, and NotebookLM?

I've been building in the research tools space and genuinely want to
understand: for those of you who use AI tools for research, what
falls short?

From my conversations with researchers so far, the most common gaps
I hear about are:
- Tools summarize individual papers but don't synthesize across them
- No tool tracks contradictions between sources
- Outputs lack provenance (where exactly did this claim come from?)
- Everything is chatbot-style — no persistent workspace to build on

Do these resonate? What else is missing?

(Context: I'm building a tool in this space and want to make sure
I'm solving real problems, not imagined ones.)
```

---

## Comment Response Templates

### When someone asks "How is this different from Elicit?"

```
Good question. Elicit is great at finding papers and extracting data
from individual papers. Lumen focuses on what happens after that — the
cross-paper synthesis.

Specifically, Lumen:
- Surfaces contradictions between sources (Elicit doesn't do this)
- Maps evidence by confidence level and type
- Produces structured artifacts (claims, gaps, next-steps) not just
  extracted tables
- Has a persistent workspace you can edit and build on

Think of it as: Elicit helps you find and extract. Lumen helps you
understand and synthesize. They're actually complementary.
```

### When someone asks "Does it hallucinate?"

```
This is the #1 thing I designed around. Every claim in Lumen's synthesis
links to a specific source, page, and direct quote. If Lumen can't
trace a claim to evidence, it flags it as uncertain rather than
asserting it.

The evidence mapping includes confidence levels (high/medium/low) so
you always know how well-supported a claim is. And the /methodology-
critic skill specifically assesses the quality of the underlying
evidence.

That said — it's AI, so I'd never recommend treating any output as
ground truth without checking. The goal is to make checking fast and
systematic, not to eliminate it.
```

### When someone is skeptical

```
Healthy skepticism. A few thoughts:

1. I'm not claiming Lumen replaces a researcher's judgment. It's a
   workspace that helps organize and structure the evidence so the
   researcher can make better judgments faster.

2. Every output is editable. If Lumen gets something wrong, you fix
   it — just like you'd edit any draft.

3. The Founding Researcher program exists precisely because the tool
   needs researcher input to get better. If you want to help make
   sure it handles [their concern] well, that's exactly what the
   beta is for.

Open to hearing more about your concerns.
```

---

## Posting Schedule

| Week | Subreddit | Post Type |
|------|-----------|-----------|
| Week 1 | r/PhD | Warmup: workflow discussion |
| Week 2 | r/GradSchool | Warmup: pain point discussion |
| Week 2 | r/AskAcademia | Warmup: "what's missing" question |
| Week 3 | r/PhD | Recruitment: Founding Researcher |
| Week 4 | r/SystematicReviews | Recruitment: Direct value |
| Week 4 | r/MachineLearning | Recruitment: Technical angle |
| Week 5 | r/academia | Recruitment: Adapted version |

**Rules:**
- Never post in 2+ subreddits on the same day
- Respond to every comment within 2 hours of posting
- Don't delete posts that don't perform well
- Be transparent that you built the tool
