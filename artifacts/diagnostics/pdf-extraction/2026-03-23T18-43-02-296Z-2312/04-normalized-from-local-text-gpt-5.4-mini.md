# I. INTRODUCTION

Large language models (LLMs) perform well but still have major limitations in domain-specific or knowledge-intensive tasks [1], especially hallucinations [2] when queries go beyond training data or require current information. Retrieval-Augmented Generation (RAG) addresses this by retrieving relevant document chunks from external knowledge bases via semantic similarity, reducing factual errors. It has been widely adopted in chatbots and other real-world applications.

RAG has developed rapidly, as summarized in the paper’s technology tree (Figure 1). Its evolution has several stages. First, during the rise of the Transformer architecture, RAG focused on improving language models by adding knowledge through Pre-Training Models (PTM), with foundational work on pre-training [3]–[5]. Then ChatGPT [6] marked a turning point: because LLMs showed strong in-context learning (ICL), RAG research shifted toward providing better information at inference time for more complex, knowledge-intensive tasks, which led to rapid growth. Later, RAG enhancement expanded beyond inference and began incorporating LLM fine-tuning.

The field has grown quickly without a systematic synthesis of its broader trajectory. This survey aims to fill that gap by mapping the RAG process and its evolution and future directions, especially its integration with LLMs. It covers both technical paradigms and research methods, summarizes three main paradigms from over 100 RAG studies, and analyzes core technologies in “Retrieval,” “Generation,” and “Augmentation.” It also notes that current research emphasizes methods more than evaluation, so the paper comprehensively reviews downstream tasks, datasets, benchmarks, and evaluation methods for RAG. Overall, it compiles and categorizes the foundational concepts, historical progression, and range of RAG methodologies and applications after LLMs, to give readers a structured understanding of LLMs and RAG, clarify strengths and weaknesses of approaches in context, and suggest future trends.

## Contributions

- A systematic review of state-of-the-art RAG methods, organized into naive RAG, advanced RAG, and modular RAG, and placed in the broader LLM landscape.
- A discussion of the core technologies in “Retrieval”, “Generation”, and “Augmentation,” and how these components work together in a complete RAG framework.
- A summary of current RAG evaluation methods, covering 26 tasks and nearly 50 datasets, with evaluation objectives, metrics, benchmarks, and tools, plus future directions for current challenges.

The paper is organized as follows: Section II introduces RAG concepts and paradigms; Sections III–V cover “Retrieval”, “Generation”, and “Augmentation”; Section VI discusses downstream tasks and evaluation; Section VII discusses challenges and future directions; Section VIII concludes.

# II. OVERVIEW OF RAG

A typical RAG application is shown in Figure 2. A user asks ChatGPT about a recent news event. Because ChatGPT relies on pre-training data, it lacks up-to-date information. RAG closes this gap by retrieving relevant articles from external databases, combining them with the question into a prompt, and enabling the LLM to generate a better-informed answer.

The paper divides RAG into three stages: Naive RAG, Advanced RAG, and Modular RAG (Figure 3). Although RAG is cost-effective and often outperforms the native LLM, it has limitations, and Advanced RAG and Modular RAG were developed in response to those shortcomings.

## A. Naive RAG

Naive RAG is the earliest paradigm and became prominent soon after ChatGPT. It follows the traditional indexing–retrieval–generation pipeline, also called a “Retrieve-Read” framework [7].

**Indexing.** Raw data in formats such as PDF, HTML, Word, and Markdown is cleaned and converted to plain text. Because LLMs have context limits, the text is split into smaller chunks. These chunks are encoded into vectors using an embedding model and stored in a vector database, enabling efficient similarity search later.

**Retrieval.** Given a query, the same encoding model transforms the query into a vector. The system computes similarity scores between the query vector and indexed chunk vectors, retrieves the top K most similar chunks, and uses them as expanded context.

**Generation.** The query and selected documents are combined into a prompt, and the LLM generates a response. Depending on task requirements, the model may use parametric knowledge or restrict itself to the provided documents. For multi-turn dialogue, conversational history can also be added to the prompt.

Naive RAG has several drawbacks:

- **Retrieval challenges.** Precision and recall can be poor, leading to irrelevant chunks or missing key information.
- **Generation difficulties.** The model may hallucinate, and outputs may be irrelevant, toxic, or biased.
- **Augmentation hurdles.** Retrieved information may be hard to integrate cleanly with the task, causing incoherent or redundant outputs. It is also difficult to judge passage importance and maintain stylistic and tonal consistency. In complex settings, a single retrieval based only on the original query may not provide enough context. There is also a risk that the generator will over-rely on retrieved content and merely echo it without synthesis.

## B. Advanced RAG

Advanced RAG addresses Naive RAG’s limitations by improving retrieval quality through pre-retrieval and post-retrieval strategies. For indexing, it uses sliding windows, finer segmentation, and metadata. It also introduces several optimization methods to improve retrieval [8].

**Pre-retrieval process.** This stage focuses on optimizing indexing and the original query. Indexing optimization aims to improve the quality of indexed content through enhanced granularity, index-structure optimization, metadata addition, alignment optimization, and mixed retrieval. Query optimization aims to make the user question clearer and better suited to retrieval through query rewriting, query transformation, query expansion, and related techniques [7], [9]–[11].

**Post-retrieval process.** After context is retrieved, it must be integrated effectively with the query. Main methods include reranking chunks and compressing context. Reranking moves the most relevant content toward the edges of the prompt and is used in frameworks such as LlamaIndex 2, LangChain 3, and HayStack [12]. Since feeding all relevant documents directly into the LLM can create information overload, post-retrieval methods select essential information, emphasize critical sections, and shorten the context.

## C. Modular RAG

Modular RAG extends the previous two paradigms with greater adaptability and versatility. It adds strategies such as a search module for similarity search and retriever fine-tuning, and introduces restructured modules [13] and rearranged pipelines [14] to address specific challenges. This modular approach is increasingly common and supports both sequential processing and end-to-end training. It builds on Naive and Advanced RAG while moving the family forward.

### 1) New Modules

Modular RAG adds specialized components:

- **Search module.** Supports direct searches over search engines, databases, and knowledge graphs using LLM-generated code and query languages [15].
- **RAG-Fusion.** Uses multi-query expansion to search from multiple perspectives, with parallel vector search and re-ranking to uncover explicit and transformative knowledge [16].
- **Memory module.** Uses LLM memory to guide retrieval, creating an unbounded memory pool and iteratively self-enhancing to better match the data distribution [17], [18].
- **Routing.** Selects the best path among data sources, including summarization, specific database searches, or merging information streams [19].
- **Predict module.** Reduces redundancy and noise by generating context directly through the LLM [13].
- **Task Adapter module.** Adapts RAG to downstream tasks, automating prompt retrieval for zero-shot inputs and creating task-specific retrievers through few-shot query generation [20], [21].

### 2) New Patterns

Modular RAG also allows module substitution and reconfiguration to handle specific challenges, going beyond the fixed “Retrieve” and “Read” structure. Examples include:

- **Rewrite-Retrieve-Read** [7], which rewrites retrieval queries using an LLM and LM-feedback to update the rewriting model.
- **Generate-Read** [13], which replaces traditional retrieval with LLM-generated content.
- **Recite-Read** [22], which retrieves from model weights to improve knowledge-intensive tasks.
- Hybrid retrieval strategies combining keyword, semantic, and vector search.
- **Sub-queries** and **hypothetical document embeddings (HyDE)** [11], which improve relevance by aligning embeddings of generated answers and real documents.
- Module rearrangements such as **Demonstrate-Search-Predict (DSP)** [23] and the iterative **Retrieve-Read-Retrieve-Read** flow of **ITER-RETGEN** [14], showing how one module’s output can strengthen another.
- Flexible orchestration in **FLARE** [24] and **Self-RAG** [25], which evaluates whether retrieval is needed in a given scenario.
- Easier integration with fine-tuning or reinforcement learning [26], such as fine-tuning the retriever, fine-tuning the generator, or collaborative fine-tuning [27].

## D. RAG vs Fine-tuning

The paper compares RAG with fine-tuning (FT) and prompt engineering. Figure 4 places the three methods in a quadrant chart by external knowledge requirement and model adaptation requirement.

- **Prompt engineering** uses the model’s inherent capabilities with minimal external knowledge and minimal adaptation.
- **RAG** is like giving the model a tailored textbook for information retrieval, and is well suited to precise information retrieval tasks.
- **FT** is like a student internalizing knowledge over time, and is suitable when specific structures, styles, or formats must be reproduced.

RAG is strong in dynamic environments because it provides real-time knowledge updates, effectively uses external knowledge sources, and offers high interpretability. Its drawbacks are higher latency and ethical concerns related to data retrieval. FT is more static and requires retraining to update, but it allows deep customization of model behavior and style. It also needs significant computational resources for dataset preparation and training. While FT can reduce hallucinations, it may struggle with unfamiliar data.

In evaluations of knowledge-intensive tasks across topics, [28] found that unsupervised fine-tuning gives some improvement, but RAG consistently outperforms it on both previously seen knowledge and entirely new knowledge. It was also found that LLMs struggle to learn new factual information through unsupervised fine-tuning. The choice between RAG and FT depends on data dynamics, customization needs, and available computation. They are not mutually exclusive and can complement each other; in some cases, combining them yields the best performance. Optimization may require multiple iterations.

# III. RETRIEVAL

In RAG, efficiently retrieving relevant documents from the data source is crucial. Key issues include the retrieval source, retrieval granularity, retrieval preprocessing, and the embedding model.

## A. Retrieval Source

RAG relies on external knowledge to enhance LLMs, and both the source type and retrieval granularity affect generation quality.

### 1) Data Structure

Text is the main retrieval source. Later, retrieval expanded to semi-structured data (PDF) and structured data (knowledge graphs, KG) for improvement. Recent work also increasingly uses content generated by LLMs themselves for retrieval and enhancement.

#### Unstructured Data

Unstructured text is the most widely used retrieval source, typically drawn from corpora. For open-domain question answering (ODQA), the main sources are Wikipedia Dump, with current major versions including HotpotQA 4 (1st October, 2017) and DPR 5 (20 December, 2018). Beyond encyclopedic data, common unstructured data also includes cross-lingual text [19] and domain-specific data, such as medical [67] and legal [29] domains.

#### Semi-structured Data

Semi-structured data typically combines text and table information, such as PDFs. It is challenging for conventional RAG systems for two reasons: text splitting may separate tables and corrupt data during retrieval, and tables complicate semantic similarity search. One approach uses LLM code abilities to execute Text-2-SQL queries on database tables, such as TableGPT [85]. Another transforms tables into text for text-based methods [75]. The paper states that neither is an optimal solution, so this area remains open for substantial research.

#### Structured Data

Structured data, such as knowledge graphs (KGs) [86], are typically verified and can provide more precise information. KnowledGPT [15] generates KB search queries and stores knowledge in a personalized base to enrich RAG knowledge. Because LLMs have limitations in understanding and answering questions about textual graphs, G-Retriever [84] combines Graph Neural Networks (GNNs), LLMs, and RAG to improve graph comprehension and question answering through soft prompting of the LLM, and uses the Prize-Collecting Steiner Tree (PCST) optimization problem for targeted …