# I. INTRODUCTION

Large language models (LLMs) achieve strong results but still have major limitations, especially on domain-specific or knowledge-intensive tasks [1]. A key failure mode is hallucination [2] when queries go beyond training data or require current information.

Retrieval-Augmented Generation (RAG) addresses this by retrieving relevant document chunks from an external knowledge base via semantic similarity and using them to support generation. This reduces factually incorrect outputs and has become widely adopted in chatbots and other real-world applications. RAG research has developed rapidly, as summarized in Figure 1.

The trajectory of RAG in the large-model era has several stages. Early RAG work emerged alongside Transformer-based language models, aiming to enhance pre-trained models (PTM) with additional knowledge, with foundational work on pre-training techniques [3]–[5]. The release of ChatGPT [6] marked a turning point: because LLMs showed strong in-context learning (ICL), RAG research shifted toward supplying better information at inference time for more complex knowledge-intensive tasks. Later, RAG increasingly incorporated LLM fine-tuning as well.

Although the field has grown quickly, there has been no systematic synthesis of its overall trajectory. This survey addresses that gap by mapping the RAG process, charting its evolution, and discussing future directions, with emphasis on integration within LLMs. It reviews over 100 RAG studies and organizes the literature around three paradigms and the core stages of “Retrieval,” “Generation,” and “Augmentation.” It also addresses a second gap: current work focuses more on methods than on evaluation, so this paper reviews downstream tasks, datasets, benchmarks, and evaluation methods for RAG. Overall, it aims to systematically compile foundational technical concepts, historical progression, and the range of RAG methodologies and applications that have emerged after LLMs.

Our contributions are as follows:

- We present a systematic review of state-of-the-art RAG methods, covering naive RAG, advanced RAG, and modular RAG, and situating RAG within the broader LLM landscape.
- We identify and discuss the core technologies in “Retrieval,” “Generation,” and “Augmentation,” and explain how they work together in a RAG framework.
- We summarize current RAG assessment methods, covering 26 tasks and nearly 50 datasets, including evaluation objectives, metrics, benchmarks, and tools, and point to future directions for addressing current challenges.

The paper is organized as follows: Section II introduces the main concept and paradigms of RAG. Sections III–V cover “Retrieval,” “Generation,” and “Augmentation.” Section VI discusses downstream tasks and evaluation. Section VII covers current challenges and future directions. Section VIII concludes.

# II. OVERVIEW OF RAG

A typical RAG application is shown in Figure 2: a user asks ChatGPT about a recent news event, but because ChatGPT depends on pre-training data it lacks up-to-date knowledge. RAG fills this gap by retrieving relevant news articles from external databases, combining them with the original question into a prompt, and enabling the LLM to generate a better-informed answer.

The RAG paradigm is categorized into three stages: Naive RAG, Advanced RAG, and Modular RAG, as shown in Figure 3. Although RAG methods are cost-effective and outperform native LLMs, they also have limitations, motivating Advanced RAG and Modular RAG.

## A. Naive RAG

Naive RAG is the earliest paradigm and became prominent shortly after ChatGPT’s adoption. It follows a traditional “Retrieve-Read” framework [7] with indexing, retrieval, and generation.

Indexing begins by cleaning and extracting raw data from formats such as PDF, HTML, Word, and Markdown into plain text. Because LLMs have context limits, the text is split into smaller chunks. These chunks are encoded into vectors with an embedding model and stored in a vector database to support later similarity search.

Retrieval uses the same encoding model to map the user query to a vector, computes similarity between the query vector and indexed chunks, and retrieves the top K most similar chunks as expanded prompt context.

Generation combines the query and retrieved documents into a prompt for the LLM. Depending on the task, the model may use its parametric knowledge or restrict itself to the provided documents. For multi-turn dialogue, prior conversation history can also be included.

Naive RAG has several drawbacks:

- Retrieval challenges: precision and recall can be poor, causing irrelevant chunks to be selected and crucial information to be missed.
- Generation difficulties: the model may hallucinate unsupported content, and outputs may be irrelevant, toxic, or biased.
- Augmentation hurdles: integrating retrieved information with the task can produce disjointed, incoherent, redundant, or repetitive outputs; it can also be difficult to judge passage importance and preserve style and tone consistency.

For complex problems, a single retrieval based only on the original query may not provide enough context. There is also a risk that generation models over-rely on augmented information and merely echo retrieved content without adding insight or synthesis.

## B. Advanced RAG

Advanced RAG is designed to overcome Naive RAG’s limitations. It focuses on improving retrieval quality through pre-retrieval and post-retrieval strategies.

To address indexing issues, it refines indexing using sliding windows, fine-grained segmentation, and metadata. It also uses several optimization methods to streamline retrieval [8].

### Pre-retrieval process

The main goal is to optimize the indexing structure and the original query. Indexing optimization improves the quality of indexed content through strategies such as enhancing data granularity, optimizing index structures, adding metadata, alignment optimization, and mixed retrieval. Query optimization aims to make the user question clearer and better suited to retrieval, using query rewriting, query transformation, query expansion, and related techniques [7], [9]–[11].

### Post-Retrieval Process

Once relevant context has been retrieved, it must be integrated effectively with the query. Main methods include reranking chunks and compressing context. Reranking moves the most relevant content to the edges of the prompt, and is used in frameworks such as LlamaIndex 2, LangChain 3, and HayStack [12]. Since feeding all relevant documents directly into LLMs can cause information overload, post-retrieval methods focus on selecting essential information, emphasizing critical sections, and shortening the context to be processed.

## C. Modular RAG

Modular RAG extends beyond the first two paradigms and is more adaptable and versatile. It introduces additional strategies such as a search module for similarity search and retriever fine-tuning. It also includes restructured RAG modules [13] and rearranged RAG pipelines [14] to address specific problems. Modular RAG supports both sequential processing and end-to-end training across components. Although distinct, it still builds on Naive and Advanced RAG.

### 1) New Modules

The Modular RAG framework adds specialized components to improve retrieval and processing:

- Search module: performs direct searches across search engines, databases, and knowledge graphs using LLM-generated code and query languages [15].
- RAG-Fusion: uses a multi-query strategy that expands user queries into multiple perspectives, combining parallel vector search and re-ranking to uncover explicit and transformative knowledge [16].
- Memory module: uses the LLM’s memory to guide retrieval, creating an unbounded memory pool that aligns text more closely with the data distribution through iterative self-enhancement [17], [18].
- Routing: selects the best path among different data sources, such as summarization, database search, or merging information streams [19].
- Predict module: reduces redundancy and noise by generating context directly through the LLM [13].
- Task Adapter module: adapts RAG to downstream tasks, automating prompt retrieval for zero-shot inputs and creating task-specific retrievers through few-shot query generation [20], [21].

This modular design streamlines retrieval and improves the quality and relevance of retrieved information across diverse tasks and queries.

### 2) New Patterns

Modular RAG also allows module substitution or reconfiguration to address specific challenges, unlike the fixed “Retrieve” and “Read” structure of Naive and Advanced RAG. It can add modules or adjust interactions among them, improving applicability across tasks.

Examples include:

- Rewrite-Retrieve-Read [7]: uses an LLM-based rewriting module and LM-feedback to update the rewriting model, improving task performance.
- Generate-Read [13]: replaces traditional retrieval with LLM-generated content.
- Recite-Read [22]: emphasizes retrieval from model weights for knowledge-intensive tasks.
- Hybrid retrieval: combines keyword, semantic, and vector search for diverse queries.
- Sub-queries and hypothetical document embeddings (HyDE) [11]: improve retrieval relevance by aligning embeddings between generated answers and real documents.
- Demonstrate-Search-Predict (DSP) [23] and ITER-RETGEN [14]: use module outputs to strengthen other modules, including the iterative Retrieve-Read-Retrieve-Read flow.
- FLARE [24] and Self-RAG [25]: enable adaptive retrieval by deciding whether retrieval is necessary in a given scenario.

A further advantage of flexible architecture is easier integration with other technologies such as fine-tuning or reinforcement learning [26]. This can include fine-tuning the retriever, fine-tuning the generator for more personalized outputs, or collaborative fine-tuning [27].

## D. RAG vs Fine-tuning

Because LLM augmentation has attracted considerable attention, RAG is often compared with fine-tuning (FT) and prompt engineering. Figure 4 contrasts them along two dimensions: external knowledge required and model adaptation required.

Prompt engineering relies mainly on the model’s inherent capabilities, with minimal need for external knowledge or model adaptation. RAG is like giving the model a tailored textbook for retrieval, making it suitable for precise information retrieval tasks. FT is like a student internalizing knowledge over time, and is suitable when specific structures, styles, or formats must be reproduced.

RAG is strong in dynamic environments because it supports real-time knowledge updates, uses external sources effectively, and is highly interpretable. However, it has higher latency and ethical concerns related to data retrieval. FT is more static and requires retraining for updates, but it allows deeper customization of behavior and style. It also requires substantial computational resources for dataset preparation and training. Although FT can reduce hallucinations, it may struggle with unfamiliar data.

Across knowledge-intensive tasks, [28] found that unsupervised fine-tuning provides some improvement, but RAG consistently outperforms it on both previously seen knowledge and entirely new knowledge. It also found that LLMs struggle to learn new factual information through unsupervised fine-tuning.

The choice between RAG and FT depends on data dynamics, customization needs, and computational resources. They are not mutually exclusive and can complement each other; in some cases, combining them yields optimal performance. Achieving satisfactory results may require multiple iterations.

# III. RETRIEVAL

In RAG, efficient retrieval of relevant documents from the data source is crucial. Key issues include retrieval source, retrieval granularity, retrieval pre-processing, and the choice of embedding model.

## A. Retrieval Source

RAG depends on external knowledge to enhance LLMs, and both the type of retrieval source and the granularity of retrieval units affect generation results.

### 1) Data Structure

Text was initially the mainstream retrieval source. Later, retrieval expanded to semi-structured data (PDF) and structured data (Knowledge Graph, KG) for enhancement. Beyond original external sources, recent research increasingly uses LLM-generated content for retrieval and enhancement.

## TABLE I  
### Summary of RAG Methods

| Method | Retrieval Source | Retrieval Data Type | Retrieval Granularity | Augmentation Stage | Retrieval process |
|---|---|---:|---|---|---|
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

### Unstructured Data

Unstructured data, especially text, is the most widely used retrieval source and is usually gathered from corpora. For open-domain question answering (ODQA), the main sources are Wikipedia Dump, including the major versions used by HotpotQA 4 (1st October, 2017) and DPR 5 (20 December, 2018). In addition to encyclopedic data, common unstructured sources include cross-lingual text [19] and domain-specific data such as medical [67] and legal [29] domains.

### Semi-structured Data

Semi-structured data typically combines text and table information, such as PDF. It is challenging for conventional RAG systems for two reasons. First, text splitting can separate tables and corrupt retrieval. Second, incorporating tables complicates semantic similarity search. One approach is to use LLM code capabilities to execute Text-2-SQL queries on tables in databases, as in TableGPT [85]. Another is to convert tables into text for text-based analysis [75]. However, neither is an optimal solution, so substantial research opportunities remain.

### Structured Data

Structured data such as knowledge graphs (KGs) [86] is typically verified and can provide more precise information. KnowledGPT [15] generates KB search queries and stores knowledge in a personalized base, enriching RAG’s knowledge content. Because LLMs struggle to understand and answer questions about textual graphs, G-Retriever [84] combines Graph Neural Networks (GNNs), LLMs, and RAG to improve graph comprehension and question answering through soft prompting of the LLM, and uses the Prize-Collecting Steiner Tree (PCST) optimization problem for targeted...