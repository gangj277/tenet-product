# Overview: Model Collapse From Recursive Synthetic Data Training

## 1) Original research question
**Under what conditions does recursive training on synthetic data lead to model collapse in generative models?**

This project targets the technical question behind a practical concern: when a generative model is repeatedly trained (or fine-tuned) using data it (or its descendants) generated, **does quality inevitably degrade**, and **what boundary conditions and mitigation strategies** are supported by credible evidence?

## 2) Interpreted research objective
To **synthesize ML research evidence (2023–2025, global)** on recursive synthetic-data training and determine:

1. **Mechanisms** proposed to explain model collapse (e.g., distribution drift, error accumulation, tail loss).
2. **Conditions** under which collapse is **inevitable** versus **avoidably delayed** or **mitigated**.
3. Which findings are **theoretical (proofs / formal models)** versus **empirical (controlled simulations / benchmarked experiments)**.
4. Credible mitigation strategies—especially **data mixing ratios**, **filtering/curation**, and **regularization/architectural interventions**—and their limitations.

## 3) Inferred research frame / working hypothesis under examination
**Working hypothesis:** *Model collapse is a genuine risk when synthetic data dominates the training distribution, but mixing in fresh real data (and/or using sufficiently strong quality control) can reduce or delay collapse.*

**In-scope working claims to test against the literature:**
- Collapse is often framed as **error accumulation and distributional narrowing** (e.g., tail disappearance/cutting) in recursive generation loops.
- In practice, **fully synthetic closed loops** are more likely to converge to degenerate behavior, while **partially synthetic regimes** may remain stable if real data is sufficiently preserved.
- Some mitigation approaches (filtering, appropriate regularization, architectural design) may reduce collapse rate, though their generality may be limited.

## 4) Scope boundaries
This review intentionally constrains attention to:

### Included
- Machine learning and AI literature addressing:
  - **Recursive training** on model-generated data
  - **Synthetic data reuse**
  - **Distribution degradation** and related “tail” effects
  - Mitigations tested with technical rigor (benchmarks, ablations, controlled simulations)
- **Primary sources** (papers, technical reports) and any closely related formal analysis.

### Excluded
- Product commentary, marketing claims, and non-technical blog posts.
- Work outside the target temporal window when possible (project focus **2023–2025**), unless a source is essential for defining the core technical claims.
- Excessive modality-specific deep dives beyond what is necessary to identify whether susceptibility differs across text/image/tabular.

### Answer coverage requirements (must answer)
- **Mechanisms** proposed for model collapse
- **Which results** suggest collapse is avoidable or mitigable
- **Evidence type**: theoretical vs empirical

## 5) Source inventory (with provenance)
**Note:** Provenance is classified as **uploaded vs discovered**. In the consolidated findings provided, each item includes a source identifier, name, and excerpt, but provenance (“uploaded” or “discovered”) is **not explicitly labeled**. The inventory below therefore lists all referenced sources and marks provenance as **unspecified** pending project tooling or metadata.

### Sources referenced in consolidated findings

1. **Unspecified provenance** — `083503ca-b550-4bfc-8ad6-2900d7b30856`  
   **How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse**  
   - Locations cited: Abstract; 3.1 Fully Synthetic; 3.2 Partially Synthetic; 4.1 Transformer-based Models  
   - Key excerpts (as provided):  
     - “model collapse cannot be avoided when training solely on synthetic data.”  
     - “total collapse is bound to happen in the Fully Synthetic setting.”  
     - “the amount of synthetic data should be exponentially smaller compared to real data…”  
     - “while mixing with real data ensures stability over generations.”

2. **Unspecified provenance** — `a599ea89-e42d-43e2-a931-547b30fff7c1`  
   **The Curse of Recursion: Training on Generated Data Makes Models Forget**  
   - Locations cited: 3 What is Model Collapse?; 4.1 Discrete distributions with exact approximation  
   - Key excerpts (as provided):  
     - “In early model collapse the model begins losing information about the tails of the distribution”  
     - “we are guaranteed to end up in a constant state… when the chain is absorbed.”

3. **Unspecified provenance** — `e527d42d-5b95-43f3-8c88-5da9815f7ea9`  
   **AI models collapse when trained on recursively generated data**  
   - Locations cited: Model collapse in language models; Ablation: Repetitions  
   - Key excerpts (as provided):  
     - “preservation of the original data allows for better model fine-tuning and leads to only minor degradation…”  
     - “enforcing this for the LLM experiments causes the perplexity to double… Models remain as susceptible to model collapse…”

4. **Unspecified provenance** — `04f02f33-7daf-4c48-8eb5-736385bcd1c3`  
   **A Tale of Tails: Model Collapse as a Change of Scaling Laws**  
   - Locations cited: Scaling Laws and Synthetic Data  
   - Key excerpts (as provided):  
     - “tail cutting” / “tail narrowing” in AI-generated data vs original.

5. **Unspecified provenance** — `10689496-ee43-49a3-a97e-a2522b7a156f`  
   **BiHMP-GAN: Bidirectional 3D Human Motion Prediction GAN**  
   - Locations cited: Approach  
   - Key excerpts (as provided):  
     - “regressing r during training enforces a one-to-one mapping, avoiding mode-collapse.”

6. **Unspecified provenance** — `d17c6a20-4fb5-4d15-a4bc-ca7eb517c0b0`  
   **Model Collapse Demystified: The Case of Regression**  
   - Locations cited: 4. Exact Test Error Characterization  
   - Key excerpts (as provided):  
     - “a good strategy for mitigating the negative effects… is regularization at an appropriate level.”

### Inventory summary by evidence role (derived from excerpts)
- **Fully synthetic inevitability / formal convergence claims:** (1), (2)
- **Partial mixing with real data as mitigation:** (1), (3)
- **Tail disappearance / tail-narrowing characterization:** (2), (4)
- **Mitigation via regularization / architectural design analogs (mode-collapse related):** (5), (6)
- **Evidence of mitigation methods failing or backfiring (ablation-based):** (3)

--- 

If you provide a file manifest or metadata indicating which sources were **uploaded** to the project workspace versus merely **discovered**, I can revise the inventory to include correct provenance labels.