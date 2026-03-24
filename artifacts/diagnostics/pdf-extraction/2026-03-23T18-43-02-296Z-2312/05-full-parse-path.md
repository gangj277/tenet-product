# 1 Retrieval-Augmented Generation for Large Language Models: A Survey

Large Language Models (LLMs) are powerful but still suffer from hallucination, outdated knowledge, and non-transparent, untraceable reasoning. Retrieval-Augmented Generation (RAG) addresses this by incorporating external knowledge, improving accuracy and credibility, especially for knowledge-intensive tasks, while enabling continuous updates and domain-specific information. This survey reviews the progression of RAG paradigms—Naive RAG, Advanced RAG, and Modular RAG—and examines the three core components of RAG frameworks: retrieval, generation, and augmentation. It also introduces current evaluation frameworks and benchmarks, and concludes with challenges and future directions.

## Abstract / Keywords
RAG merges LLMs’ intrinsic knowledge with external databases. The survey covers the evolution of RAG paradigms, the technologies used in retrieval, generation, and augmentation, evaluation methods, and open problems.

## I. Introduction

LLMs have achieved notable success but remain limited in domain-specific and knowledge-intensive tasks [1], including producing “hallucinations” [2] when queries exceed training data or require current information. RAG mitigates this by retrieving relevant document chunks from external knowledge bases using semantic similarity, thereby reducing factual errors. Its integration into LLMs has driven widespread adoption and improved chatbots and real-world applicability.

RAG has developed rapidly, as summarized in the paper’s technology tree. Its trajectory has distinct stages:

- In the early stage, RAG emerged alongside the Transformer architecture and focused on improving language models via additional knowledge in Pre-Training Models (PTM), with foundational work on pre-training refinement [3]–[5].
- The arrival of ChatGPT [6] marked a turning point: LLMs demonstrated strong in-context learning (ICL), and RAG research shifted toward supplying better information at inference time for more complex, knowledge-intensive tasks.
- Later work extended RAG beyond inference and increasingly integrated it with LLM fine-tuning.

Despite rapid growth, RAG lacked a systematic synthesis clarifying its broader trajectory. This survey aims to fill that gap by mapping the RAG process, charting its evolution and likely future paths, and focusing on integration with LLMs. It synthesizes over 100 RAG studies, analyzes the core stages of “Retrieval,” “Generation,” and “Augmentation,” and also reviews evaluation across downstream tasks, datasets, benchmarks, and methods.

### Contributions
- A systematic review of state-of-the-art RAG methods, organized into naive RAG, advanced RAG, and modular RAG, and placed within the broader LLM landscape.
- Identification and discussion of the central technologies in “Retrieval,” “Generation,” and “Augmentation,” including their synergies.
- A summary of current RAG assessment methods covering 26 tasks, nearly 50 datasets, evaluation objectives and metrics, and benchmarks/tools, along with future directions for addressing current challenges.

The paper is organized as follows: Section II introduces the main concept and paradigms of RAG. Sections III–V cover the core components—retrieval, generation, and augmentation. Section VI discusses downstream tasks and evaluation. Section VII covers challenges and future directions. Section VIII concludes.

## II. Overview of RAG

A typical RAG application is question answering: a user asks ChatGPT about recent news, but the base model lacks updated information because of its reliance on pre-training data. RAG fills this gap by retrieving relevant external knowledge, combining retrieved articles with the original question into a prompt that enables the LLM to generate a better-informed answer.

The paper categorizes RAG into three stages: Naive RAG, Advanced RAG, and Modular RAG. Although RAG methods are cost-effective and often outperform native LLMs, they also have limitations; Advanced RAG and Modular RAG were developed in response to shortcomings in Naive RAG.

### A. Naive RAG

Naive RAG is the earliest paradigm, emerging soon after ChatGPT became widely adopted. It follows a traditional “Retrieve-Read” framework [7] with three steps: indexing, retrieval, and generation.

**Indexing.** Raw data in formats such as PDF, HTML, Word, and Markdown is cleaned and converted to plain text. Because of context limits in language models, the text is split into smaller chunks, encoded as vectors with an embedding model, and stored in a vector database for efficient similarity search.

**Retrieval.** Given a user query, the same encoding model converts the query into a vector. Similarity scores are computed between the query vector and indexed chunk vectors, and the top K most similar chunks are retrieved as expanded context.

**Generation.** The query and selected documents are combined into a prompt, and the LLM generates the answer. Depending on task requirements, the model may use its parametric knowledge or restrict itself to the provided documents. In dialogue settings, conversation history can also be included to support multi-turn interaction.

Naive RAG has several drawbacks:

- **Retrieval challenges:** precision and recall may be poor, causing irrelevant chunks to be selected and important information to be missed.
- **Generation difficulties:** the model may hallucinate content unsupported by retrieved context; outputs can also be irrelevant, toxic, or biased.
- **Augmentation hurdles:** integrating retrieved information with different tasks can produce disjointed, incoherent, or redundant outputs; determining passage relevance and maintaining stylistic and tonal consistency are also difficult.

For complex tasks, a single retrieval step based on the original query may not provide enough context. There is also concern that generation models may over-rely on augmented information and simply echo retrieved content rather than synthesizing new information.

### B. Advanced RAG

Advanced RAG addresses Naive RAG’s limitations through specific improvements, especially in retrieval quality, using pre-retrieval and post-retrieval strategies.

**Pre-retrieval process.** This stage optimizes indexing structure and the original query. Indexing improvements include finer granularity, better index structures, metadata, alignment optimization, and mixed retrieval. Query optimization aims to make the user’s question clearer and more suitable for retrieval through query rewriting, query transformation, query expansion, and related methods [7], [9]–[11].

**Post-retrieval process.** After relevant context is retrieved, it must be integrated effectively with the query. Main methods include reranking chunks and context compressing. Reranking moves the most relevant content to the edges of the prompt, as implemented in frameworks such as LlamaIndex, LangChain, and HayStack [12]. Since feeding all relevant documents directly into an LLM can cause information overload, post-retrieval methods emphasize essential information, critical sections, and shorter contexts.

### C. Modular RAG

Modular RAG extends beyond the previous paradigms with greater adaptability and versatility. It introduces diverse strategies for improving components, such as adding a search module for similarity search and refining the retriever through fine-tuning. Restructured RAG modules [13] and rearranged RAG pipelines [14] address specific challenges. Modular RAG supports both sequential processing and integrated end-to-end training across components. It builds on the principles of Advanced and Naive RAG while refining them.

#### 1) New Modules
Modular RAG adds specialized components:

- **Search module:** performs direct searches across search engines, databases, and knowledge graphs using LLM-generated code and query languages [15].
- **RAG-Fusion:** uses a multi-query strategy to expand the user query from different perspectives, combining parallel vector searches and re-ranking to uncover explicit and transformative knowledge [16].
- **Memory module:** uses LLM memory to guide retrieval, creating an unbounded memory pool and iteratively self-enhancing alignment with data distribution [17], [18].
- **Routing:** selects the best pathway across data sources, including summarization, database search, or merging information streams [19].
- **Predict module:** reduces redundancy and noise by generating context directly through the LLM [13].
- **Task Adapter module:** adapts RAG to downstream tasks, including automated prompt retrieval for zero-shot inputs and task-specific retrievers via few-shot query generation [20], [21].

These additions streamline retrieval and improve relevance and precision across tasks.

#### 2) New Patterns
Modular RAG also allows module substitution or reconfiguration, unlike the fixed “Retrieve” and “Read” structure of Naive and Advanced RAG. This includes changing interaction flows among modules.

Examples include:

- **Rewrite-Retrieve-Read [7]:** uses an LLM rewriting module and LM-feedback to update the rewriting model, improving task performance.
- **Generate-Read [13]:** replaces traditional retrieval with LLM-generated content.
- **Recite-Read [22]:** emphasizes retrieval from model weights for knowledge-intensive tasks.
- **Hybrid retrieval:** combines keyword, semantic, and vector search.
- **Sub-queries and hypothetical document embeddings (HyDE) [11]:** improve retrieval relevance by aligning generated answers with real documents.
- **DSP [23]** and **ITER-RETGEN [14]:** demonstrate dynamic module orchestration, where outputs from one module strengthen another.
- **FLARE [24]** and **Self-RAG [25]:** exemplify adaptive retrieval by evaluating when retrieval is necessary.
- Modular architecture also makes integration with fine-tuning or reinforcement learning easier [26], including fine-tuning retrievers, fine-tuning generators, or collaborative fine-tuning [27].

### D. RAG vs Fine-tuning

RAG is often compared with fine-tuning (FT) and prompt engineering. The paper contrasts them using a quadrant chart with two dimensions: external knowledge requirements and model adaptation requirements.

- **Prompt engineering** uses the model’s inherent capabilities with minimal external knowledge and minimal model adaptation.
- **RAG** is like giving the model a tailored textbook for retrieval; it is suited to precise information retrieval tasks.
- **FT** is like a student internalizing knowledge over time; it is suitable when a specific structure, style, or format must be replicated.

RAG is strong in dynamic settings because it provides real-time knowledge updates, uses external sources effectively, and offers high interpretability. Its drawbacks are higher latency and ethical concerns about data retrieval. FT is more static, requiring retraining for updates, but enables deep customization of behavior and style. It needs substantial computational resources for dataset preparation and training, and while it can reduce hallucinations, it may struggle with unfamiliar data.

In multiple evaluations of knowledge-intensive tasks across topics, [28] found that unsupervised fine-tuning showed some improvement, but RAG consistently outperformed it, both for knowledge seen during training and for entirely new knowledge. It also found that LLMs struggle to learn new factual information through unsupervised fine-tuning. The choice between RAG and FT depends on data dynamics, customization needs, and computational resources. The two are not mutually exclusive and can complement each other; in some cases, their combination is optimal. Achieving satisfactory performance may require multiple iterations of RAG and FT optimization.

## III. Retrieval

Efficient retrieval of relevant documents from the data source is crucial in RAG. Key issues include retrieval source, retrieval granularity, preprocessing, and the embedding model.

### A. Retrieval Source

RAG relies on external knowledge, and both the type of retrieval source and the granularity of retrieval units affect generation results.

#### 1) Data Structure
Text is the mainstream retrieval source. Later, retrieval expanded to semi-structured data (PDF) and structured data (Knowledge Graph, KG) for enhancement. Beyond original external sources, there is also a growing trend toward using content generated by LLMs themselves for retrieval and enhancement.

**Table I. Summary of RAG Methods**

| Method | Retrieval Source | Retrieval Data Type | Retrieval Granularity | Augmentation Stage | Retrieval process |
|---|---|---|---|---|---|
| CoG [29] | Wikipedia | Text | Phrase | Pre-training | Iterative |
| DenseX [30] | FactoidWiki | Text | Proposition | Inference | Once |
| EAR [31] | Dataset-base | Text | Sentence | Tuning | Once |
| UPRISE [20] | Dataset-base | Text | Sentence | Tuning | Once |
| RAST [32] | Dataset-base | Text | Sentence | Tuning | Once |
| Self-Mem [17] | Dataset-base | Text | Sentence | Tuning | Iterative |
| FLARE [24] | Search Engine,Wikipedia | Text | Sentence | Tuning | Adaptive |
| PGRA [33] | Wikipedia | Text | Sentence | Inference | Once |
| FILCO [34] | Wikipedia | Text | Sentence | Inference | Once |
| RADA [35] | Dataset-base | Text | Sentence | Inference | Once |
| Filter-rerank [36] | Synthesized dataset | Text | Sentence | Inference | Once |
| R-GQA [37] | Dataset-base | Text | Sentence Pair | Tuning | Once |
| LLM-R [38] | Dataset-base | Text | Sentence Pair | Inference | Iterative |
| TIGER [39] | Dataset-base | Text | Item-base | Pre-training | Once |
| LM-Indexer [40] | Dataset-base | Text | Item-base | Tuning | Once |
| BEQUE [9] | Dataset-base | Text | Item-base | Tuning | Once |
| CT-RAG [41] | Synthesized dataset | Text | Item-base | Tuning | Once |
| Atlas [42] | Wikipedia, Common Crawl | Text | Chunk | Pre-training | Iterative |
| RAVEN [43] | Wikipedia | Text | Chunk | Pre-training | Once |
| RETRO++ [44] | Pre-training Corpus | Text | Chunk | Pre-training | Iterative |
| INSTRUCTRETRO [45] | Pre-training corpus | Text | Chunk | Pre-training | Iterative |
| RRR [7] | Search Engine | Text | Chunk | Tuning | Once |
| RA-e2e [46] | Dataset-base | Text | Chunk | Tuning | Once |
| PROMPTAGATOR [21] | BEIR | Text | Chunk | Tuning | Once |
| AAR [47] | MSMARCO,Wikipedia | Text | Chunk | Tuning | Once |
| RA-DIT [27] | Common Crawl,Wikipedia | Text | Chunk | Tuning | Once |
| RAG-Robust [48] | Wikipedia | Text | Chunk | Tuning | Once |
| RA-Long-Form [49] | Dataset-base | Text | Chunk | Tuning | Once |
| CoN [50] | Wikipedia | Text | Chunk | Tuning | Once |
| Self-RAG [25] | Wikipedia | Text | Chunk | Tuning | Adaptive |
| BGM [26] | Wikipedia | Text | Chunk | Inference | Once |
| CoQ [51] | Wikipedia | Text | Chunk | Inference | Iterative |
| Token-Elimination [52] | Wikipedia | Text | Chunk | Inference | Once |
| PaperQA [53] | Arxiv,Online Database,PubMed | Text | Chunk | Inference | Iterative |
| NoiseRAG [54] | FactoidWiki | Text | Chunk | Inference | Once |
| IAG [55] | Search Engine,Wikipedia | Text | Chunk | Inference | Once |
| NoMIRACL [56] | Wikipedia | Text | Chunk | Inference | Once |
| ToC [57] | Search Engine,Wikipedia | Text | Chunk | Inference | Recursive |
| SKR [58] | Dataset-base,Wikipedia | Text | Chunk | Inference | Adaptive |
| ITRG [59] | Wikipedia | Text | Chunk | Inference | Iterative |
| RAG-LongContext [60] | Dataset-base | Text | Chunk | Inference | Once |
| ITER-RETGEN [14] | Wikipedia | Text | Chunk | Inference | Iterative |
| IRCoT [61] | Wikipedia | Text | Chunk | Inference | Recursive |
| LLM-Knowledge-Boundary [62] | Wikipedia | Text | Chunk | Inference | Once |
| RAPTOR [63] | Dataset-base | Text | Chunk | Inference | Recursive |
| RECITE [22] | LLMs | Text | Chunk | Inference | Once |
| ICRALM [64] | Pile,Wikipedia | Text | Chunk | Inference | Iterative |
| Retrieve-and-Sample [65] | Dataset-base | Text | Doc | Tuning | Once |
| Zemi [66] | C4 | Text | Doc | Tuning | Once |
| CRAG [67] | Arxiv | Text | Doc | Inference | Once |
| 1-PAGER [68] | Wikipedia | Text | Doc | Inference | Iterative |
| PRCA [69] | Dataset-base | Text | Doc | Inference | Once |
| QLM-Doc-ranking [70] | Dataset-base | Text | Doc | Inference | Once |
| Recomp [71] | Wikipedia | Text | Doc | Inference | Once |
| DSP [23] | Wikipedia | Text | Doc | Inference | Iterative |
| RePLUG [72] | Pile | Text | Doc | Inference | Once |
| ARM-RAG [73] | Dataset-base | Text | Doc | Inference | Iterative |
| GenRead [13] | LLMs | Text | Doc | Inference | Iterative |
| UniMS-RAG [74] | Dataset-base | Text | Multi | Tuning | Once |
| CREA-ICL [19] | Dataset-base | Crosslingual,Text | Sentence | Inference | Once |
| PKG [75] | LLM | Tabular,Text | Chunk | Inference | Once |
| SANTA [76] | Dataset-base | Code,Text | Item | Pre-training | Once |
| SURGE [77] | Freebase | KG | Sub-Graph | Tuning | Once |
| MK-ToD [78] | Dataset-base | KG | Entity | Tuning | Once |
| Dual-Feedback-ToD [79] | Dataset-base | KG | Entity Sequence | Tuning | Once |
| KnowledGPT [15] | Dataset-base | KG | Triplet | Inference | Muti-time |
| FABULA [80] | Dataset-base,Graph | KG | Entity | Inference | Once |
| HyKGE [81] | CMeKG | KG | Entity | Inference | Once |
| KALMV [82] | Wikipedia | KG | Triplet | Inference | Iterative |
| RoG [83] | Freebase | KG | Triplet | Inference | Iterative |
| G-Retriever [84] | Dataset-base | TextGraph | Sub-Graph | Inference | Once |

Unstructured data, especially text, is the most common retrieval source and is usually gathered from corpora. For open-domain question answering (ODQA), the primary retrieval source is Wikipedia Dump, with current major versions including HotpotQA 4 (1st October, 2017) and DPR 5 (20 December, 2018). Other unstructured sources include cross-lingual text [19] and domain-specific data such as medical [67] and legal [29] data.

Semi-structured data such as PDFs mixes text and tables, creating two challenges for conventional RAG: text splitting can separate tables and corrupt retrieval, and tables complicate semantic similarity search. One approach uses LLM code abilities to execute Text-2-SQL on tables, as in TableGPT [85]. Another converts tables into text for text-based analysis [75]. The paper notes that neither is optimal, leaving substantial room for research.

Structured data such as knowledge graphs [86] can provide more precise, verified information. KnowledGPT [15] generates KB search queries and stores knowledge in a personalized base to enrich RAG. Because LLMs struggle with textual graphs, G-Retriever [84] combines Graph Neural Networks (GNNs), LLMs, and RAG to improve graph comprehension and question answering through soft prompting of the LLM, and uses the Prize-Collecting Steiner Tree (PCST) optimization problem for targeted ...