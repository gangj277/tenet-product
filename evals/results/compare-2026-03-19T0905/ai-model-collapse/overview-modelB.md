# Overview: Model Collapse From Recursive Synthetic Data Training

## 1. Original research question
**Under what conditions does recursive training on synthetic data lead to model collapse in generative models?**

## 2. Interpreted research objective
To synthesize machine learning evidence on whether “model collapse” in generative modeling is an inevitable consequence of recursive synthetic-data training loops, and to identify **credible mitigation strategies** (data-mixing regimes, filtering/selection, regularization, and architecture- or objective-level interventions). The project aims to separate **theoretical mechanisms** from **empirical observations**, and to determine the **boundary conditions** under which collapse is catastrophic versus manageable.

## 3. Inferred research frame / working hypothesis
**Working hypothesis:** Model collapse is a **real and often severe risk** when synthetic data increasingly dominates the training distribution, due to **distribution drift and error accumulation** across generations. However, collapse may be **reduced or delayed** by maintaining a sufficiently large proportion of **fresh real data** and/or applying **high-fidelity selection** that prevents degradation of distributional support (e.g., tail diversity).

This frame emphasizes:  
- **Distributional effects** (e.g., “tail disappearance/narrowing”) as a central observable signature of collapse.  
- **Stability conditions** tied to the **synthetic-to-real mix** (including potentially strict thresholds).  
- **Mechanistic claims** grounded in formal arguments (e.g., recursive processes with absorbing/degenerate states) versus **engineering claims** grounded in experimental ablations and controlled simulations.

## 4. Scope boundaries
- **Included:** ML literature focused on recursive/self-referential synthetic training, synthetic data reuse, distribution shift/degradation, and technical mitigations for generative-model quality loss (especially for language and related generative settings).  
- **Time horizon:** **2023–2025**, per project specification (global literature).  
- **Included evidence types:** theoretical analyses, controlled simulations, and empirical evaluations using standard generative-model metrics and collapse proxies (e.g., diversity/tail behavior, perplexity/FID-like indicators, and task performance under recursive training).  
- **Excluded:** product commentary, non-technical blog posts, and general-purpose opinion pieces without technical substantiation.  
- **Working emphasis:** classification of evidence as **theoretical vs. empirical** and identification of **mechanisms** versus **mitigation effectiveness**.

## 5. Source inventory (with provenance)
The following sources are included based on the provided consolidated findings. **No additional uploaded files or documents were included in the prompt beyond the provided findings**, so all entries below are treated as **discovered (external)** rather than **uploaded**.

### Discovered sources (external)
1. **How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse**  
   - **Source ID:** `083503ca-b550-4bfc-8ad6-2900d7b30856`  
   - **Provenance:** discovered  
   - **Evidence locations referenced:** Abstract; §4.1 (Transformer-based Models); §3.1 (Fully Synthetic); §3.2 (Partially Synthetic)

2. **The Curse of Recursion: Training on Generated Data Makes Models Forget**  
   - **Source ID:** `a599ea89-e42d-43e2-a931-547b30fff7c1`  
   - **Provenance:** discovered  
   - **Evidence locations referenced:** §3 (What is Model Collapse?); §4.1 (Discrete distributions with exact approximation)

3. **AI models collapse when trained on recursively generated data**  
   - **Source ID:** `e527d42d-5b95-43f3-8c88-5da9815f7ea9`  
   - **Provenance:** discovered  
   - **Evidence locations referenced:** “Model collapse in language models”; Ablations (e.g., “Repetitions”)

4. **A Tale of Tails: Model Collapse as a Change of Scaling Laws**  
   - **Source ID:** `04f02f33-7daf-4c48-8eb5-736385bcd1c3`  
   - **Provenance:** discovered  
   - **Evidence locations referenced:** “Scaling Laws and Synthetic Data” (e.g., tail cutting/narrowing via figures)

5. **BiHMP-GAN: Bidirectional 3D Human Motion Prediction GAN**  
   - **Source ID:** `10689496-ee43-49a3-a97e-a2522b7a156f`  
   - **Provenance:** discovered  
   - **Evidence locations referenced:** Approach (GAN-specific discussion related to preventing mode-collapse)

6. **Model Collapse Demystified: The Case of Regression**  
   - **Source ID:** `d17c6a20-4fb5-4d15-a4bc-ca7eb517c0b0`  
   - **Provenance:** discovered  
   - **Evidence locations referenced:** §4 (Exact Test Error Characterization) and associated mitigation via regularization

### Uploaded sources
- **None specified in the provided prompt.**