# I. INTRODUCTION

Large language models (LLMs) are highly capable but still limited in domain-specific and knowledge-intensive tasks [1], especially by hallucinations [2] when queries exceed training data or require up-to-date information. Retrieval-Augmented Generation (RAG) addresses this by retrieving relevant document chunks from an external knowledge base via semantic similarity, then using them to ground generation. This reduces factual errors and has led to widespread adoption in chatbots and real-world applications.

RAG has developed rapidly, as summarized by the technology tree in Figure 1. Its trajectory has distinct stages. Early RAG emerged alongside Transformer-based pre-training, focusing on adding knowledge to pre-trained models (PTMs) through foundational pre-training refinements [3]–[5]. The later arrival of ChatGPT [6] marked a turning point: because LLMs showed strong in-context learning (ICL), RAG research shifted toward supplying better information at inference time for more complex knowledge-intensive tasks. As the field progressed, RAG increasingly combined with LLM fine-tuning rather than remaining limited to inference.

Although the field has expanded quickly, it lacked a systematic synthesis of its broader trajectory. This survey addresses that gap by mapping the RAG process and its evolution, with emphasis on RAG’s integration into LLMs. It covers both technical paradigms and research methods, summarizes three main paradigms from over 100 RAG studies, and analyzes key technologies in the three core stages: “Retrieval,” “Generation,” and “Augmentation.” It also reviews how RAG is evaluated, including downstream tasks, datasets, benchmarks, and evaluation methods.

The paper’s contributions are:
- A systematic review of state-of-the-art RAG methods, organized into naive RAG, advanced RAG, and modular RAG, and situated within the broader LLM landscape.
- A discussion of the central technologies in “Retrieval,” “Generation,” and “Augmentation,” and how they work together in a cohesive RAG framework.
- A summary of current RAG assessment methods covering 26 tasks, nearly 50 datasets, evaluation objectives and metrics, and available benchmarks and tools, plus future directions for addressing current challenges.

The paper is organized as follows: Section II introduces the main concept and current paradigms of RAG. Sections III–V cover the core components of “Retrieval,” “Generation,” and “Augmentation.” Section VI discusses downstream tasks and evaluation. Section VII covers challenges and future directions. Section VIII concludes.

# II. OVERVIEW OF RAG

A typical RAG application is shown in Figure 2. A user asks ChatGPT about a recent news event. Because ChatGPT depends on pre-training data, it cannot initially answer with current updates. RAG fills this gap by retrieving relevant news articles from external databases, combining them with the original question into a prompt, and enabling the LLM to produce a better-informed answer.

The RAG paradigm is evolving and is categorized into three stages, as shown in Figure 3: Naive RAG, Advanced RAG, and Modular RAG. Although RAG methods are cost-effective and outperform native LLMs, they have limitations. Advanced RAG and Modular RAG were developed in response to the shortcomings of Naive RAG.

## A. Naive RAG

Naive RAG is the earliest paradigm and became prominent shortly after ChatGPT’s widespread adoption. It follows the traditional “Retrieve-Read” framework [7] and consists of indexing, retrieval, and generation.

**Indexing.** Raw data in formats such as PDF, HTML, Word, and Markdown are cleaned and converted into plain text. To fit LLM context limits, text is split into smaller chunks. Chunks are encoded into vectors with an embedding model and stored in a vector database for efficient similarity search.

**Retrieval.** A user query is encoded with the same model used in indexing, and similarity scores are computed between the query vector and chunk vectors. The top K most similar chunks are retrieved and used as expanded prompt context.

**Generation.** The query and retrieved documents are combined into a prompt, and the LLM generates an answer. Depending on task needs, the model may use its parametric knowledge or restrict itself to the provided documents. In multi-turn settings, conversational history can also be included.

Naive RAG has three main drawbacks:
- **Retrieval challenges:** precision and recall are often insufficient, so irrelevant chunks may be retrieved and important information missed.
- **Generation difficulties:** the model may hallucinate, producing content unsupported by the retrieved context; outputs may also be irrelevant, toxic, or biased.
- **Augmentation hurdles:** integrating retrieved information into the task can produce disjointed, incoherent, or redundant outputs, and it is difficult to determine passage relevance and maintain stylistic consistency. In complex cases, one retrieval step may not provide enough context, and generators may over-rely on retrieved content, merely echoing it rather than synthesizing new information.

## B. Advanced RAG

Advanced RAG adds targeted improvements to address Naive RAG’s limitations. It focuses on retrieval quality through pre-retrieval and post-retrieval strategies. To improve indexing, it uses sliding windows, fine-grained segmentation, and metadata. It also introduces several retrieval optimization methods [8].

**Pre-retrieval process.** This stage optimizes the indexing structure and the original query. Indexing optimization aims to improve indexed content quality via enhanced data granularity, optimized index structures, metadata addition, alignment optimization, and mixed retrieval. Query optimization aims to make the user’s question clearer and more suitable for retrieval, using query rewriting, query transformation, query expansion, and related techniques [7], [9]–[11].

**Post-retrieval process.** After context is retrieved, it must be integrated effectively with the query. Main methods include reranking chunks and compressing context. Reranking moves the most relevant content to the edges of the prompt, as implemented in LlamaIndex, LangChain, and HayStack [12]. Because feeding all retrieved documents directly into LLMs can cause information overload, post-retrieval methods select essential information, emphasize key sections, and shorten the context to be processed.

## C. Modular RAG

Modular RAG extends the previous paradigms with greater adaptability and versatility. It adds strategies such as a search module for similarity search and retriever fine-tuning. It also introduces restructured modules [13] and rearranged pipelines [14] to address specific challenges. Modular RAG is increasingly common and supports both sequential processing and end-to-end training across components. It builds on Naive and Advanced RAG while refining them.

### 1) New Modules

Modular RAG adds specialized components to improve retrieval and processing:
- **Search module:** performs direct searches across sources such as search engines, databases, and knowledge graphs using LLM-generated code and query languages [15].
- **RAG-Fusion:** uses a multi-query strategy that expands a user query into multiple perspectives, combined with parallel vector searches and intelligent reranking to uncover explicit and transformative knowledge [16].
- **Memory module:** uses the LLM’s memory to guide retrieval, creating an unbounded memory pool through iterative self-enhancement [17], [18].
- **Routing:** selects the best pathway among sources for tasks such as summarization, database search, or merging information streams [19].
- **Predict module:** reduces redundancy and noise by generating context directly through the LLM [13].
- **Task Adapter:** adapts RAG to downstream tasks, automating prompt retrieval for zero-shot inputs and building task-specific retrievers via few-shot query generation [20], [21].

These modules streamline retrieval and improve information quality, relevance, precision, and flexibility across tasks and queries.

### 2) New Patterns

Modular RAG also allows module substitution and reconfiguration. Unlike the fixed Retrieve-Read structure of Naive and Advanced RAG, it can integrate new modules or alter interactions among existing ones.

Examples include:
- **Rewrite-Retrieve-Read** [7], which uses the LLM to refine retrieval queries through rewriting and an LM-feedback mechanism to update the rewriting model.
- **Generate-Read** [13], which replaces traditional retrieval with LLM-generated content.
- **Recite-Read** [22], which retrieves from model weights to better handle knowledge-intensive tasks.
- Hybrid retrieval strategies combining keyword, semantic, and vector search.
- **HyDE** [11], which uses sub-queries and hypothetical document embeddings to improve retrieval by matching generated answers with real documents.
- Module rearrangements such as **DSP** [23] and the iterative **Retrieve-Read-Retrieve-Read** flow of **ITER-RETGEN** [14], where outputs from one module improve another.
- Flexible orchestration in **FLARE** [24] and **Self-RAG** [25], which evaluate whether retrieval is needed in different scenarios.
- Easier integration with fine-tuning or reinforcement learning [26], including fine-tuning the retriever, fine-tuning the generator, or collaborative fine-tuning [27].

## D. RAG vs Fine-tuning

RAG is often compared with fine-tuning (FT) and prompt engineering. Figure 4 positions the three methods by external knowledge requirement and model adaptation requirement. Prompt engineering uses the model’s inherent capabilities with minimal external knowledge and minimal adaptation. RAG is like giving the model a tailored textbook for information retrieval and is well suited to precise retrieval tasks. FT is like a student internalizing knowledge over time and is suitable for reproducing specific structures, styles, or formats.

RAG is strong in dynamic environments because it enables real-time knowledge updates and uses external knowledge sources with high interpretability, but it has higher latency and ethical concerns about data retrieval. FT is more static because updates require retraining, but it enables deep customization of behavior and style. It also needs substantial computational resources for dataset preparation and training, and while it may reduce hallucinations, it can struggle with unfamiliar data.

In evaluations across multiple knowledge-intensive tasks, [28] showed that unsupervised fine-tuning offers some improvement, but RAG consistently outperforms it on both previously seen knowledge and entirely new knowledge. It was also found that LLMs struggle to learn new factual information through unsupervised fine-tuning. The choice between RAG and FT depends on data dynamics, customization needs, and available computation. They are not mutually exclusive and can complement each other; in some cases, combining them yields the best performance. Optimizing RAG and FT together may require multiple iterations.

# III. RETRIEVAL

In RAG, efficiently retrieving relevant documents from the data source is crucial. Key issues include retrieval source, retrieval granularity, retrieval preprocessing, and the embedding model.

## A. Retrieval Source

RAG uses external knowledge to augment LLMs, and both retrieval source type and retrieval-unit granularity affect generation quality.

### 1) Data Structure

Text was initially the main retrieval source. Later, retrieval expanded to semi-structured data (PDF) and structured data (knowledge graphs, KG) for further enhancement. Beyond original external sources, recent work increasingly uses content generated by LLMs themselves for retrieval and enhancement.

**Unstructured data.** Text remains the most widely used source and is mainly collected from corpora. For open-domain question answering (ODQA), primary sources are Wikipedia dumps, including the current major versions used in HotpotQA 4 (1st October , 2017) and DPR 5 (20 December, 2018). Other unstructured sources include cross-lingual text [19] and domain-specific data such as medical [67] and legal [29] data.

**Semi-structured data.** This usually refers to data combining text and tables, such as PDF. Conventional RAG systems face two main challenges here: text splitting can separate tables and corrupt data during retrieval, and tables complicate semantic similarity search. One approach is to use LLM code abilities to execute Text-2-SQL queries on tables in databases, as in TableGPT [85]. Another is to convert tables into text for text-based analysis [75]. Neither is optimal, leaving substantial room for research.

**Structured data.** Knowledge graphs (KGs) [86] are verified and can provide more precise information. KnowledGPT [15] generates KB search queries and stores knowledge in a personalized base, enriching RAG knowledge. Because LLMs struggle to understand and answer questions about textual graphs, G-Retriever [84] combines GNNs, LLMs, and RAG, improving graph comprehension and question answering through soft prompting of the LLM and using the Prize-Collecting Steiner Tree (PCST) optimization problem for targeted retrieval.