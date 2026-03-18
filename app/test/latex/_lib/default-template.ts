export const DEFAULT_LATEX_TEMPLATE = String.raw`\documentclass[12pt]{article}

% ── Packages ──────────────────────────────────────────────
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath,amssymb,amsthm}
\usepackage[margin=1in]{geometry}
\usepackage{hyperref}
\usepackage{booktabs}
\usepackage{natbib}

% ── Theorem environments ──────────────────────────────────
\newtheorem{theorem}{Theorem}[section]
\newtheorem{lemma}[theorem]{Lemma}

% ── Metadata ──────────────────────────────────────────────
\title{A Brief Survey of Attention Mechanisms\\in Neural Networks}
\author{Jane Researcher\thanks{Department of Computer Science, Example University.}}
\date{\today}

\begin{document}

\maketitle

\begin{abstract}
This paper provides a concise overview of attention mechanisms as used in modern deep learning architectures. We trace the development from early sequence-to-sequence models through self-attention and the Transformer, highlighting key theoretical insights and practical considerations. Our goal is to give the reader a working intuition for how and why attention works.
\end{abstract}

% ── Section 1 ─────────────────────────────────────────────
\section{Introduction}

Sequence modelling has been a central challenge in machine learning for decades. Recurrent neural networks (RNNs) and their gated variants—LSTMs \citep{hochreiter1997} and GRUs \citep{cho2014}—made significant progress but struggled with long-range dependencies. The introduction of \emph{attention} \citep{bahdanau2015} offered an elegant solution: rather than compressing an entire input into a fixed-length vector, the model learns to focus on the most relevant parts of the input at each decoding step.

Today, attention is the backbone of large language models, vision transformers, and multimodal systems alike.

% ── Section 2 ─────────────────────────────────────────────
\section{Attention Formulation}

Given a query vector $\mathbf{q}$, a set of key vectors $\{\mathbf{k}_i\}$, and corresponding value vectors $\{\mathbf{v}_i\}$, scaled dot-product attention is defined as:

\begin{equation}\label{eq:attention}
  \mathrm{Attention}(\mathbf{Q}, \mathbf{K}, \mathbf{V})
    = \mathrm{softmax}\!\left(\frac{\mathbf{Q}\mathbf{K}^\top}{\sqrt{d_k}}\right)\mathbf{V}
\end{equation}

\noindent where $d_k$ is the dimensionality of the key vectors. The scaling factor $1/\sqrt{d_k}$ prevents the dot products from growing too large, which would push the softmax into regions with vanishingly small gradients.

\begin{theorem}[Universality of Self-Attention]
A single self-attention layer with sufficient head dimension can approximate any permutation-equivariant function on a finite set of input tokens \citep{yun2020}.
\end{theorem}

% ── Section 3 ─────────────────────────────────────────────
\section{Experimental Comparison}

Table~\ref{tab:comparison} summarises representative results across three common benchmarks.

\begin{table}[h]
\centering
\caption{Comparison of attention variants on standard benchmarks.}
\label{tab:comparison}
\begin{tabular}{@{}lccc@{}}
\toprule
\textbf{Model} & \textbf{WMT'14 EN-DE} & \textbf{MNLI} & \textbf{SQuAD 2.0} \\
\midrule
LSTM + Attention   & 26.4 & 78.6 & 74.5 \\
Transformer Base   & 27.3 & 84.1 & 80.8 \\
Transformer Large  & 28.4 & 86.3 & 83.0 \\
Linear Attention   & 25.8 & 81.2 & 77.9 \\
\bottomrule
\end{tabular}
\end{table}

The results confirm that full softmax attention consistently outperforms linear approximations, although the latter offer attractive computational trade-offs for very long sequences.

% ── Conclusion ────────────────────────────────────────────
\section*{Conclusion}

Attention mechanisms have fundamentally reshaped deep learning. Understanding Equation~\eqref{eq:attention} and its multi-head extension is now prerequisite knowledge for practitioners. Future work will likely focus on more efficient approximations and extending attention to new modalities.

% ── References ────────────────────────────────────────────
\begin{thebibliography}{9}

\bibitem[Bahdanau et~al.(2015)]{bahdanau2015}
D.~Bahdanau, K.~Cho, and Y.~Bengio.
\newblock Neural machine translation by jointly learning to align and translate.
\newblock In \emph{Proc.\ ICLR}, 2015.

\bibitem[Cho et~al.(2014)]{cho2014}
K.~Cho, B.~van Merri\"enboer, C.~Gulcehre, D.~Bahdanau, F.~Bougares, H.~Schwenk, and Y.~Bengio.
\newblock Learning phrase representations using RNN encoder-decoder for statistical machine translation.
\newblock In \emph{Proc.\ EMNLP}, 2014.

\bibitem[Hochreiter and Schmidhuber(1997)]{hochreiter1997}
S.~Hochreiter and J.~Schmidhuber.
\newblock Long short-term memory.
\newblock \emph{Neural Computation}, 9(8):1735--1780, 1997.

\bibitem[Yun et~al.(2020)]{yun2020}
C.~Yun, S.~Bhojanapalli, A.~S. Rawat, S.~Reddi, and S.~Kumar.
\newblock Are transformers universal approximators of sequence-to-sequence functions?
\newblock In \emph{Proc.\ ICLR}, 2020.

\end{thebibliography}

\end{document}
`;
