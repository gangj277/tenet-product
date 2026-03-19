## Claim 1 (Strongest): Model collapse is unavoidable when training exclusively on recursively generated synthetic data.
- **Claim statement:** Model collapse is an inevitable degenerative process in fully synthetic recursive training loops; in the studied settings, it cannot be avoided.
- **Supporting sources:**
  - [Source: 083503ca-b550-4bfc-8ad6-2900d7b30856] *How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse* (Abstract): “**model collapse cannot be avoided when training solely on synthetic data.**”
  - [Source: a599ea89-e42d-43e2-a931-547b30fff7c1] *The Curse of Recursion: Training on Generated Data Makes Models Forget* (4.1 Discrete distributions with exact approximation): “**we are guaranteed to end up in a constant state** … having lost all the information of the original distribution when the chain is absorbed.”
- **Contradicting sources:** None reported.
- **Confidence assessment:** **High** — The claim is supported by explicit impossibility/inevitability statements and (in one case) a convergence argument to degenerate/constant states.

---

## Claim 2 (Strongest): Recursive training forms a Markov-like process whose absorbing states correspond to degenerate (constant) distributions, implying loss of original information.
- **Claim statement:** Under the formalization used in prior work, recursive synthetic training can be modeled so that only degenerate distributions are absorbing; hence the process converges to a constant-state collapse.
- **Supporting sources:**
  - [Source: a599ea89-e42d-43e2-a931-547b30fff7c1] *The Curse of Recursion: Training on Generated Data Makes Models Forget* (4.1 Discrete distributions with exact approximation): “**the chain is absorbed** … **having lost all the information** of the original distribution” and “**we are guaranteed to end up in a constant state**.”
- **Contradicting sources:** None reported.
- **Confidence assessment:** **High** — The claim is directly tied to a theoretical convergence/absorbing-state argument in the cited work.

---

## Claim 3 (Strongest): A key observable signature of model collapse is “tail disappearance” (tail cutting/narrowing), i.e., loss of low-probability events from the original distribution.
- **Claim statement:** Model collapse manifests as progressive loss of information about distribution tails; generated data can exhibit tail cutting/narrowing relative to the original distribution over successive generations.
- **Supporting sources:**
  - [Source: a599ea89-e42d-43e2-a931-547b30fff7c1] *The Curse of Recursion: Training on Generated Data Makes Models Forget* (3 What is Model Collapse?): “**the model begins losing information about the tails of the distribution**”
  - [Source: 04f02f33-7daf-4c48-8eb5-736385bcd1c3] *A Tale of Tails: Model Collapse as a Change of Scaling Laws* (Scaling Laws and Synthetic Data): “Figure 2 shows that AI-generated data can exhibit **‘tail cutting’** or **‘tail narrowing’** compared to original data.”
- **Contradicting sources:** None reported.
- **Confidence assessment:** **High** — The signature is supported by both theoretical framing (tail information loss) and empirical/scaling-law style observations (tail cutting/narrowing).

---

## Claim 4 (Strongest practical mitigation): Maintaining a non-trivial fraction of real data in the training mix mitigates or substantially delays collapse.
- **Claim statement:** Incorporating real (human-generated) data during fine-tuning can reduce degradation; in the cited experiments, preserving a small percentage of real data yields only minor performance loss relative to the fully recursive setting.
- **Supporting sources:**
  - [Source: e527d42d-5b95-43f3-8c88-5da9815f7ea9] *AI models collapse when trained on recursively generated data* (“Model collapse in language models”): “**preservation of the original data** … leads to **only minor degradation** of performance.”
  - [Source: 083503ca-b550-4bfc-8ad6-2900d7b30856] *How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse* (4.1 Transformer-based Models): “**mixing with real data ensures stability over generations.**”
- **Contradicting sources:**
  - [Source: 083503ca-b550-4bfc-8ad6-2900d7b30856] (3.2 Partially Synthetic): “**the amount of synthetic data should be exponentially smaller compared to real data** in order to ensure that p remains close to p(1).”
- **Confidence assessment:** **High** — Multiple sources support stability from real-data mixing; the main limitation is a potentially stringent real-vs-synthetic ratio requirement.

---

## Claim 5 (Medium): Data/regularization/architectural interventions can reduce collapse risk, but their effectiveness is not uniformly reliable and can be task- or objective-dependent.
- **Claim statement:** Certain mitigation strategies—e.g., architectural constraints (such as enforcing one-to-one mappings) and appropriately-leveled regularization—can prevent mode-collapse or mitigate negative effects, while some non-repetition penalties may worsen susceptibility.
- **Supporting sources:**
  - [Source: 10689496-ee43-49a3-a97e-a2522b7a156f] *BiHMP-GAN: Bidirectional 3D Human Motion Prediction GAN* (Approach): “**regressing r during training enforces a one-to-one mapping, avoiding mode-collapse.**”
  - [Source: d17c6a20-4fb5-4d15-a4bc-ca7eb517c0b0] *Model Collapse Demystified: The Case of Regression* (4. Exact Test Error Characterization): “mitigating … learning on **AI-generated data** is **regularization at an appropriate level**.”
- **Contradicting sources:**
  - [Source: e527d42d-5b95-43f3-8c88-5da9815f7ea9] *AI models collapse when trained on recursively generated data* (Ablation: Repetitions): “**enforcing this for the LLM experiments causes the perplexity to double** … **Models remain as susceptible to model collapse, if not more.**”
- **Confidence assessment:** **Medium** — Evidence spans different problem settings (GAN mode-collapse vs. recursive synthetic data collapse vs. regression/regularization theory). Results indicate mitigation can work, but also show interventions (e.g., repetition penalties) can backfire in some recursive generation regimes.