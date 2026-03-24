## I. Introduction

Large language models (LLMs) are effective but still limited in domain-specific and knowledge-intensive tasks [1], especially because they can produce hallucinations [2] when queried beyond training data or for current information. Retrieval-Augmented Generation (RAG) addresses this by retrieving relevant document chunks from external knowledge bases through semantic similarity calculation, thereby reducing factually incorrect output. This has made RAG widely used in chatbots and other real-world applications.

RAG has developed rapidly, as summarized by the paper’s technology tree. Its trajectory has stage characteristics:  
- early RAG emerged alongside Transformers, aiming to enhance language models with additional knowledge via pre-training models (PTM), with foundational work on pre-training techniques [3]–[5];  
- the arrival of ChatGPT [6] marked a turning point, because LLMs showed strong in-context learning (ICL), and RAG research shifted toward supplying better information to LLMs at inference time for more complex knowledge-intensive tasks;  
- later work extended RAG beyond inference to incorporate LLM fine-tuning.

Despite rapid growth, the field lacked a systematic synthesis clarifying its trajectory. This survey addresses that gap by mapping the RAG process and its evolution, focusing on integration with LLMs. It reviews more than 100 RAG studies, summarizes three main paradigms, and analyzes the core stages of “Retrieval,” “Generation,” and “Augmentation.” It also reviews how RAG is evaluated, including downstream tasks, datasets, benchmarks, and evaluation methods.

The paper’s contributions are:
- a systematic review of state-of-the-art RAG methods, tracing the evolution through naive RAG, advanced RAG, and modular RAG;
- an analysis of the core technologies in “Retrieval,” “Generation,” and “Augmentation,” and how these components work together;
- a summary of current RAG assessment methods, covering 26 tasks, nearly 50 datasets, evaluation objectives and metrics, plus current benchmarks and tools, and a discussion of future directions.

The paper is organized as follows: Section II introduces RAG concepts and paradigms. Sections III–V cover “Retrieval,” “Generation,” and “Augmentation.” Section VI addresses downstream tasks and evaluation. Section VII discusses challenges and future directions. Section VIII concludes.

## II. Overview of RAG

A typical RAG application is question answering over recent news: because ChatGPT relies on pre-training data, it cannot provide up-to-date answers on its own. RAG fills this gap by retrieving relevant news articles from external databases, combining them with the original question into a prompt, and enabling the LLM to generate a better-informed answer.

The paper categorizes RAG into three stages: Naive RAG, Advanced RAG, and Modular RAG. Although RAG methods are cost-effective and outperform native LLMs, they still have limitations; Advanced RAG and Modular RAG arise in response to the shortcomings of Naive RAG.

### A. Naive RAG

Naive RAG is the earliest paradigm, becoming prominent soon after ChatGPT’s adoption. It follows a “Retrieve-Read” framework [7] with three steps: indexing, retrieval, and generation.

**Indexing.** Raw data in formats such as PDF, HTML, Word, and Markdown are cleaned and converted into plain text. Because of LLM context limits, the text is split into chunks, encoded into vectors with an embedding model, and stored in a vector database for later similarity search.

**Retrieval.** A user query is encoded with the same model used during indexing. Similarity scores between the query vector and chunk vectors are computed, and the top K most similar chunks are retrieved as expanded prompt context.

**Generation.** The query and retrieved documents are combined into a prompt, and the LLM generates an answer. Depending on task requirements, the model may use its parametric knowledge or restrict itself to the provided documents. In dialogue settings, conversation history may also be included for multi-turn interaction.

Naive RAG has several drawbacks:
- **Retrieval challenges:** precision and recall can be poor, causing irrelevant or misaligned chunks to be selected and important information to be missed.
- **Generation difficulties:** hallucination can occur, with outputs unsupported by retrieved context; outputs may also be irrelevant, toxic, or biased.
- **Augmentation hurdles:** integrating retrieved information into different tasks can produce disjointed, incoherent, or redundant outputs, and it can be difficult to determine the significance of passages and maintain stylistic consistency.

For complex tasks, a single retrieval based on the original query may not provide enough context. There is also a risk that generation models rely too heavily on augmented information and merely echo retrieved content without synthesis.

### B. Advanced RAG

Advanced RAG improves Naive RAG by addressing its limitations, mainly through pre-retrieval and post-retrieval strategies. For indexing, it refines chunking with sliding windows, fine-grained segmentation, and metadata. It also introduces optimization methods to streamline retrieval [8].

**Pre-retrieval process.** This stage optimizes the indexing structure and the original query. Indexing optimization aims to improve indexed content quality through data granularity, index structure optimization, metadata addition, alignment optimization, and mixed retrieval. Query optimization aims to make the user question clearer and more suitable for retrieval via query rewriting, query transformation, query expansion, and related techniques [7], [9]–[11].

**Post-retrieval process.** After relevant context is retrieved, it must be integrated effectively with the query. Main methods include reranking chunks and compressing context. Re-ranking moves the most relevant content to the edges of the prompt, as implemented in frameworks such as LlamaIndex 2, LangChain 3, and HayStack [12]. Since feeding all relevant documents directly into LLMs can overload them and dilute focus, post-retrieval methods emphasize selecting essential information, highlighting critical sections, and shortening context.

### C. Modular RAG

Modular RAG extends the previous paradigms by offering greater adaptability and versatility. It introduces diverse strategies for improving components, such as adding a search module for similarity search and fine-tuning the retriever. Restructured RAG modules [13] and rearranged pipelines [14] have been proposed for specific challenges. Modular RAG supports both sequential processing and end-to-end training across components, while building on the foundations of Naive and Advanced RAG.

#### 1) New Modules

Modular RAG adds specialized components:
- **Search module:** supports searches over search engines, databases, and knowledge graphs using LLM-generated code and query languages [15].
- **RAG-Fusion:** uses a multi-query strategy to expand a user query into different perspectives, then applies parallel vector searches and intelligent re-ranking to find explicit and transformative knowledge [16].
- **Memory module:** uses LLM memory to guide retrieval, creating an unbounded memory pool and aligning text more closely with data distribution through iterative self-enhancement [17], [18].
- **Routing:** selects optimal pathways through multiple data sources, including summarization, specific database search, or merging information streams [19].
- **Predict module:** generates context directly through the LLM to reduce redundancy and noise while maintaining relevance and accuracy [13].
- **Task Adapter:** adapts RAG to downstream tasks, including automatic prompt retrieval for zero-shot inputs and task-specific retrievers from few-shot query generation [20], [21].

#### 2) New Patterns

Modular RAG also allows module substitution and reconfiguration to address specific challenges. This goes beyond the fixed “Retrieve” and “Read” mechanism of Naive and Advanced RAG. New interaction patterns include:
- **Rewrite-Retrieve-Read** [7], which uses an LLM-based rewriting module and LM-feedback to update the rewriting model, improving task performance;
- **Generate-Read** [13], which replaces traditional retrieval with LLM-generated content;
- **Recite-Read** [22], which emphasizes retrieval from model weights to improve knowledge-intensive tasks;
- hybrid retrieval strategies combining keyword, semantic, and vector search;
- sub-queries and hypothetical document embeddings (HyDE) [11] to improve retrieval relevance by matching generated-answer embeddings with real documents;
- module reordering and interaction changes such as **Demonstrate-Search-Predict (DSP)** [23] and **ITER-RETGEN** [14], where outputs from one module improve another;
- flexible orchestration such as **FLARE** [24] and **Self-RAG** [25], which evaluate whether retrieval is needed in a given scenario.

A further advantage of modularity is easier integration with other technologies such as fine-tuning or reinforcement learning [26]. This can include fine-tuning the retriever, fine-tuning the generator for more personalized outputs, or collaborative fine-tuning [27].

### D. RAG vs Fine-tuning

RAG is often compared with fine-tuning (FT) and prompt engineering. The paper uses a quadrant chart with two dimensions: external knowledge required and model adaptation required.

- **Prompt engineering** uses the model’s inherent capabilities with minimal external knowledge and minimal model modification.
- **RAG** is like giving a model a tailored textbook for retrieval, making it suitable for precise information retrieval. It is strong in dynamic environments because it offers real-time knowledge updates and high interpretability, but it has higher latency and raises ethical concerns about data retrieval.
- **FT** is like a student internalizing knowledge over time. It suits tasks requiring specific structures, styles, or formats. It is more static, requiring retraining for updates, but enables deep customization. It also requires substantial computational resources for dataset preparation and training. While FT can reduce hallucinations, it may struggle with unfamiliar data.

In evaluations across knowledge-intensive tasks, [28] showed that unsupervised fine-tuning offers some improvement, but RAG consistently outperforms it on both existing knowledge seen during training and entirely new knowledge. It also found that LLMs struggle to learn new factual information through unsupervised fine-tuning. The choice between RAG and FT depends on data dynamics, customization needs, and computational resources. They are not mutually exclusive and can complement each other, with combined use sometimes yielding optimal performance. Achieving satisfactory results may require multiple optimization iterations.

## III. Retrieval

Efficient retrieval of relevant documents from the data source is crucial in RAG. Key issues include retrieval source, retrieval granularity, preprocessing, and embedding-model selection.

### A. Retrieval Source

RAG relies on external knowledge to enhance LLMs, and both the type of source and the retrieval granularity affect generation quality.

#### 1) Data Structure

Text was initially the mainstream retrieval source. Later, retrieval expanded to semi-structured data (PDF) and structured data (Knowledge Graph, KG) for enhancement. Recent work also uses content generated by LLMs themselves for retrieval and enhancement.

**Unstructured data.** Text is the most widely used retrieval source, usually gathered from corpora. For open-domain question answering (ODQA), the main sources are Wikipedia Dumps, with current major versions including HotpotQA 4 (1st October , 2017), DPR 5 (20 December, 2018). Other unstructured sources include cross-lingual text [19] and domain-specific data such as medical [67] and legal data [29].

**Semi-structured data.** This usually refers to data combining text and tables, such as PDF. It is challenging for conventional RAG because text splitting may separate tables and corrupt data, and tables can complicate semantic similarity search. One approach uses LLM code abilities to run Text-2-SQL on tables in databases, such as TableGPT [85]. Another transforms tables into text for text-based analysis [75]. The paper states that neither is optimal, indicating substantial research opportunities.

**Structured data.** Knowledge graphs (KGs) [86] are verified and can provide more precise information. KnowledGPT [15] generates KB search queries and stores knowledge in a personalized base to improve knowledge richness. To address LLM limitations in understanding and answering questions about textual graphs, G-Retriever [84] integrates Graph Neural Networks (GNNs), LLMs, and RAG, enhancing graph comprehension and question answering through soft prompting of the LLM, and uses the Prize-Collecting Steiner Tree (PCST) optimization problem for targeted ...