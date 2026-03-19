## Claim 1 (Strongest): Fully synthetic recursive training leads to unavoidable model collapse (degeneration to a constant/absorbing state)

- **Claim statement:** Model collapse is an inevitable degenerative process when models are trained exclusively on recursively generated synthetic data.
- **Supporting sources:**
  - [Source: 083503ca-b550-4bfc-8ad6-2900d7b30856] *How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse* (Abstract) — “Specifically, we demonstrate that model collapse cannot be avoided when training solely on synthetic data.”
  - [Source: a599ea89-e42d-43e2-a931-547b30fff7c1] *The Curse of Recursion: Training on Generated Data Makes Models Forget* (4.1 Discrete distributions with exact approximation) — “we are guaranteed to end up in a constant state… when the chain is absorbed.”
- **Contradicting sources:** None reported.
- **Confidence assessment:** **High** — Multiple sources explicitly assert inevitability in the fully synthetic closed-loop setting, including formal/distributional arguments (e.g., absorbing states).

---

## Claim 2: Model collapse is characterized by loss of distribution tails (“tail disappearance” / “tail cutting”)

- **Claim statement:** Model collapse manifests as progressive loss of low-probability events from the original data distribution—i.e., “tail disappearance” or “tail cutting/narrowing.”
- **Supporting sources:**
  - [Source: a599ea89-e42d-43e2-a931-547b30fff7c1] *The Curse of Recursion: Training on Generated Data Makes Models Forget* (3 What is Model Collapse?) — “In early model collapse the model begins losing information about the tails of the distribution”
  - [Source: 04f02f33-7daf-4c48-8eb5-736385bcd1c3] *A Tale of Tails: Model Collapse as a Change of Scaling Laws* (Scaling Laws and Synthetic Data) — “Figure 2 shows that AI-generated data can exhibit ‘tail cutting’ or ‘tail narrowing’…”
- **Contradicting sources:** None reported.
- **Confidence assessment:** **High** — Independent sources describe the same qualitative signature (tail loss) using different framing/experiments.

---

## Claim 3: Mixing real data with synthetic data can mitigate collapse; stability improves when a sufficient fraction of real data is preserved

- **Claim statement:** Model collapse can be mitigated or avoided by maintaining a sufficient ratio of real human-generated data in the training mix.
- **Supporting sources:**
  - [Source: e527d42d-5b95-43f3-8c88-5da9815f7ea9] *AI models collapse when trained on recursively generated data* (Model collapse in language models) — “We find that preservation of the original data allows for better model fine-tuning and leads to only minor degradation of performance.”
  - [Source: 083503ca-b550-4bfc-8ad6-2900d7b30856] *How Bad is Training on Synthetic Data? A Statistical Analysis of Language Model Collapse* (4.1 Transformer-based Models) — “while mixing with real data ensures stability over generations.”
- **Contradicting sources:**
  - [Source: 083503ca-b550-4bfc-8ad6-2900d7b30856] (3.2 Partially Synthetic) — “the amount of synthetic data should be exponentially smaller compared to real data in order to ensure that p remains close to p(1).”
- **Confidence assessment:** **High** — Both sources support mixing real data as a stabilizer; the main disagreement is about how stringent the ratio requirement is (not whether mixing helps).

---

## Claim 4 (Weaker): Mitigation via architectural/regularization interventions can reduce mode-collapse, but some non-repetition/penalty approaches may worsen or fail to prevent collapse

- **Claim statement:** Certain architectural interventions and training regularization can prevent or delay degeneration (mode collapse), but some strategies (e.g., repetition/non-repetition penalties in the reported LLM setting) may not be robust and can even exacerbate collapse.
- **Supporting sources:**
  - [Source: 10689496-ee43-49a3-a97e-a2522b7a156f] *BiHMP-GAN: Bidirectional 3D Human Motion Prediction GAN* (Approach) — “regressing r during training enforces a one-to-one mapping, avoiding mode-collapse.”
  - [Source: d17c6a20-4fb5-4d15-a4bc-ca7eb517c0b0] *Model Collapse Demystified: The Case of Regression* (4. Exact Test Error Characterization) — “a good strategy for mitigating the negative effects on learning on AI-generated data is regularization at an appropriate level.”
- **Contradicting sources:**
  - [Source: e527d42d-5b95-43f3-8c88-5da9815f7ea9] *AI models collapse when trained on recursively generated data* (Ablation: Repetitions) — “enforcing this for the LLM experiments causes the perplexity to double… Models remain as susceptible to model collapse, if not more.”
- **Confidence assessment:** **Medium** — Evidence for mitigation exists, but effectiveness is clearly context/task-dependent (GAN-based and regression-theory claims don’t directly transfer to the LLM recursion setting). The repetition-penalty contradiction is strong for that specific approach.