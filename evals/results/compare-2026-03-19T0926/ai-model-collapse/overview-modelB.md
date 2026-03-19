# Overview — Model Collapse From Recursive Synthetic Data Training

## 1. Original research question
**Under what conditions does recursive training on synthetic data lead to model collapse in generative models?**

## 2. Interpreted research objective
This project aims to **synthesize technical evidence** to determine whether “model collapse” in recursive synthetic-data training is:
- **an inevitable outcome** (a true failure mode under broad conditions), or
- **a contingent phenomenon** with **clear boundary conditions** and **credible mitigation strategies**.

Concretely, the research focuses on identifying:
1. **Mechanisms** proposed to explain collapse.
2. **Empirical and theoretical results** indicating when collapse is avoidable or can be delayed.
3. **Validated mitigation interventions**, especially those involving **mixing fresh real data**, data curation/filtering, or architectural/training changes.

## 3. Inferred research frame / working hypothesis
**Working hypothesis:**  
Model collapse is a **real risk** when synthetic data **dominates** the training distribution in recursive loops, driven by **distribution drift and error accumulation**, but it can be **reduced or delayed** by **mixing fresh real data** and applying **appropriate data selection/regularization**.

**Working mechanisms under examination:**
- **Distribution narrowing / tail disappearance** (“tail cutting” or “tail narrowing”) over successive generations.
- **Closed-loop dynamics** where recursive sampling forms a process that converges toward degenerate outcomes (e.g., constant/delta-like distributions), depending on the synthetic/real mixture.
- **Error accumulation** (distinguishing whether collapse is more fundamentally driven by approximation/sampling error vs. other dynamics).
- **Contamination effects** where initial synthetic bias accelerates later degradation.

## 4. Scope boundaries
This synthesis is constrained to:

- **Included:** ML research on  
  - recursive or iterated training on generated/synthetic data,  
  - synthetic data reuse loops,  
  - distribution degradation/collapse dynamics,  
  - technical mitigations (data mixing, filtering, training objectives/regularization, and architecture-level interventions) when supported by research evidence.

- **Excluded:**  
  - product commentary, marketing material, and non-technical blog posts,  
  - non-research opinion pieces,  
  - work outside the stated time horizon where it does not directly establish core definitions or mechanisms relevant to 2023–2025 findings.

**Time horizon:** 2023–2025 (with allowance for foundational mechanisms only if needed for interpretation).  
**Geography:** Global literature.

## 5. Source inventory (provenance: uploaded vs discovered)
Only sources explicitly present in the consolidated findings are included below.

### Uploaded sources
No sources are marked as “uploaded” in the provided materials.

### Discovered sources
The following sources were discovered via the consolidated findings and include the listed source identifiers, titles, and locational/contextual evidence.

1. **083503ca-b550-4bfc-8ad6-2900d7b30856** — *“How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse”*  
   - Evidence locations referenced: **Abstract**, **3.1 Fully Synthetic**, **3.2 Partially Synthetic**, **4.1 Transformer-based Models**  
   - Key claim coverage: inevitability under fully synthetic training; stability under mixing; constraint suggesting synthetic must be exponentially smaller than real; Markov-chain/distribution convergence framing for collapse dynamics.

2. **a599ea89-e42d-43e2-a931-547b30fff7c1** — *“The Curse of Recursion: Training on Generated Data Makes Models Forget”*  
   - Evidence locations referenced: **3 What is Model Collapse?**, **4.1 Discrete distributions with exact approximation**  
   - Key claim coverage: early collapse characterized by tail information loss; discrete-process framing leading to convergence toward degenerate/constant states under recursion assumptions.

3. **e527d42d-5b95-43f3-8c88-5da9815f7ea9** — *“AI models collapse when trained on recursively generated data”*  
   - Evidence locations referenced: **Model collapse in language models**, **Ablation: Repetitions**  
   - Key claim coverage: partial mitigation via preserving a fraction of real data (e.g., ~10% reported); non-repetition penalties may worsen susceptibility; provides empirical grounding for mixture-ratio effects.

4. **04f02f33-7daf-4c48-8eb5-736385bcd1c3** — *“A Tale of Tails: Model Collapse as a Change of Scaling Laws”*  
   - Evidence locations referenced: **Scaling Laws and Synthetic Data**  
   - Key claim coverage: synthetic data can exhibit **tail cutting/narrowing** relative to original distributions; links collapse manifestations to scaling-law changes.

5. **10689496-ee43-49a3-a97e-a2522b7a156f** — *“BiHMP-GAN: Bidirectional 3D Human Motion Prediction GAN”*  
   - Evidence locations referenced: **Approach**  
   - Key claim coverage (used in this project context): training/regularization design that enforces mapping characteristics described as avoiding mode-collapse (task-specific but informative about architectural objectives).

6. **d17c6a20-4fb5-4d15-a4bc-ca7eb517c0b0** — *“Model Collapse Demystified: The Case of Regression”*  
   - Evidence locations referenced: **4. Exact Test Error Characterization**  
   - Key claim coverage (used in this project context): regularization at an appropriate level can mitigate negative effects of learning on AI-generated data; frames mitigation in a regression/learning-theory setting.

--- 

*Note:* The synthesized claims summarize evidence contained in the consolidated findings. If additional 2023–2025 sources beyond those listed above are to be incorporated, they should be appended to this inventory with the same provenance format (uploaded vs discovered).