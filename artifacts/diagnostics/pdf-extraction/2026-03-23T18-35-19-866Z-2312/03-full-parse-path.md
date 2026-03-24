# I. Introduction

Large language models (LLMs) are highly capable but still limited in domain-specific or knowledge-intensive tasks [1], especially by hallucinations [2] when queries exceed training data or require current information. Retrieval-Augmented Generation (RAG) addresses this by retrieving relevant document chunks from an external knowledge base via semantic similarity, then using them to support generation. This reduces factual errors and has made RAG a key technology for chatbots and real-world LLM applications.

RAG has developed rapidly, and the paper’s technology tree shows its stages across pre-training, fine-tuning, and inference. Early work arose with Transformer-based pre-training, focusing on adding knowledge to language models through Pre-Training Models (PTM) [3]–[5]. The release of ChatGPT [6] marked a shift: research increasingly used RAG to supply better information to LLMs at inference time for more complex and knowledge-intensive tasks. Later, RAG began to integrate more with LLM fine-tuning. Despite this rapid growth, the field lacked a systematic synthesis. This survey aims to fill that gap by mapping RAG’s evolution and future directions, focusing on its integration with LLMs.

The paper considers both technical paradigms and research methods, summarizing three main paradigms from over 100 RAG studies and analyzing the core stages of “Retrieval,” “Generation,” and “Augmentation.” It also reviews downstream tasks, datasets, benchmarks, and evaluation methods, since current work tends to emphasize methods more than evaluation. The paper’s stated goals are to compile and categorize foundational concepts, historical progression, methodologies, and applications after LLMs, and to help readers understand large models and RAG, compare retrieval augmentation techniques, assess strengths and weaknesses in different settings, and anticipate future trends.

The contributions are:
- A systematic review of state-of-the-art RAG methods, organized into naive RAG, advanced RAG, and modular RAG, and placed within the broader LLM landscape.
- A discussion of the central technologies in “Retrieval”, “Generation” and “Augmentation,” including how they work together as a unified RAG framework.
- A summary of current RAG evaluation methods, covering 26 tasks and nearly 50 datasets, including evaluation objectives, metrics, benchmarks, and tools, along with future directions for addressing current challenges.

The paper is organized as follows: Section II introduces the concept and paradigms of RAG. Sections III–V cover “Retrieval,” “Generation,” and “Augmentation.” Section VI discusses downstream tasks and evaluation. Section VII addresses challenges and future directions. Section VIII concludes.

# II. Overview of RAG

A typical RAG application is question answering about recent news: ChatGPT alone may not know recent developments due to reliance on pre-training data, but RAG bridges the gap by retrieving relevant news articles from external databases and combining them with the original question to form the prompt for the LLM.

The paper categorizes RAG into three stages: Naive RAG, Advanced RAG, and Modular RAG. Although RAG methods are cost-effective and outperform native LLMs, they have limitations, and Advanced RAG and Modular RAG arise to address those shortcomings.

## A. Naive RAG

Naive RAG is the earliest paradigm, emerging shortly after ChatGPT’s widespread adoption. It follows a traditional indexing–retrieval–generation process, also called a “Retrieve-Read” framework [7].

- **Indexing.** Raw data from PDF, HTML, Word, and Markdown is cleaned and converted to plain text, split into smaller chunks, encoded into vectors by an embedding model, and stored in a vector database for efficient similarity search.
- **Retrieval.** A user query is encoded with the same model used at indexing, similarity scores are computed between the query vector and stored chunk vectors, and the top K most similar chunks are retrieved as expanded context.
- **Generation.** The query and selected documents are combined into a prompt for the LLM, which may answer using its parametric knowledge or only the provided documents. For multi-turn dialogue, conversational history can also be added.

Naive RAG has three major drawbacks:
- **Retrieval challenges:** precision and recall can be poor, causing irrelevant chunk selection or missing crucial information.
- **Generation difficulties:** the model may hallucinate unsupported content, and outputs may be irrelevant, toxic, or biased.
- **Augmentation hurdles:** integrating retrieved information with the task can produce disjointed, incoherent, or redundant outputs; determining passage relevance and maintaining stylistic and tonal consistency is difficult. A single retrieval based only on the original query may not provide sufficient context, and generation models may over-rely on augmented information and simply echo retrieved content instead of synthesizing it.

## B. Advanced RAG

Advanced RAG addresses Naive RAG’s limitations through pre-retrieval and post-retrieval strategies, focusing on improving retrieval quality. For indexing, it refines techniques through sliding windows, fine-grained segmentation, and metadata incorporation. It also uses optimization methods to streamline retrieval [8].

### Pre-retrieval process

This stage optimizes indexing structure and the original query.

- **Indexing optimization** aims to improve indexed content quality through enhanced data granularity, optimized index structures, metadata addition, alignment optimization, and mixed retrieval.
- **Query optimization** aims to make the user’s question clearer and more suitable for retrieval, using query rewriting, query transformation, query expansion, and related techniques [7], [9]–[11].

### Post-Retrieval Process

After relevant context is retrieved, it must be integrated effectively with the query.

- Main methods include **reranking chunks** and **context compressing**.
- Reranking moves the most relevant content to the edges of the prompt, a strategy used in frameworks such as LlamaIndex 2, LangChain 3, and HayStack [12].
- Because feeding all retrieved documents directly into LLMs can overload them and dilute key details with irrelevant content, post-retrieval methods focus on selecting essential information, emphasizing critical sections, and shortening the context.

## C. Modular RAG

Modular RAG goes beyond the first two paradigms and is more adaptable and versatile. It adds diverse strategies for improving components, such as a search module for similarity search and retriever fine-tuning. It also introduces restructured RAG modules [13] and rearranged RAG pipelines [14] to address specific challenges. Modular RAG supports both sequential processing and integrated end-to-end training across components. It builds on the principles of Naive and Advanced RAG while advancing them.

### 1) New Modules

Modular RAG introduces specialized components:
- **Search module:** supports direct searches across search engines, databases, and knowledge graphs, using LLM-generated code and query languages [15].
- **RAG-Fusion:** uses a multi-query strategy to expand the user query into diverse perspectives, combines parallel vector searches, and applies intelligent reranking to uncover explicit and transformative knowledge [16].
- **Memory module:** uses LLM memory to guide retrieval, creating an unbounded memory pool and aligning text more closely with the data distribution through iterative self-enhancement [17], [18].
- **Routing:** selects the optimal pathway across data sources for a query, such as summarization, database search, or merging information streams [19].
- **Predict module:** reduces redundancy and noise by generating context directly through the LLM [13].
- **Task Adapter module:** adapts RAG to downstream tasks, including automating prompt retrieval for zero-shot inputs and creating task-specific retrievers through few-shot query generation [20], [21].

These modules streamline retrieval and improve the quality and relevance of retrieved information across a wide range of tasks.

### 2) New Patterns

Modular RAG allows module substitution and reconfiguration to address specific challenges, unlike the fixed “Retrieve” and “Read” structure of Naive and Advanced RAG. It can also change interaction flow among existing modules.

Examples include:
- **Rewrite-Retrieve-Read** [7], which uses an LLM rewriting module and LM-feedback mechanism to update the rewriting model and improve task performance.
- **Generate-Read** [13], which replaces traditional retrieval with LLM-generated content.
- **Recite-Read** [22], which emphasizes retrieval from model weights to improve knowledge-intensive task handling.
- **Hybrid retrieval**, combining keyword, semantic, and vector searches for diverse queries.
- **Sub-queries** and **hypothetical document embeddings (HyDE)** [11], which improve retrieval relevance by focusing on embedding similarity between generated answers and real documents.
- **Demonstrate-Search-Predict (DSP)** [23] and the iterative **Retrieve-Read-Retrieve-Read** flow of **ITER-RETGEN** [14], which use outputs from one module to strengthen another.
- Flexible orchestration in **FLARE** [24] and **Self-RAG** [25], which evaluates whether retrieval is needed in different scenarios.

This flexible architecture also makes it easier to integrate with fine-tuning or reinforcement learning [26], including fine-tuning the retriever, fine-tuning the generator, or collaborative fine-tuning [27].

## D. RAG vs Fine-tuning

The paper compares RAG, fine-tuning (FT), and prompt engineering using two dimensions: external knowledge requirements and model adaptation requirements.

- **Prompt engineering** relies mainly on the model’s inherent capabilities, with minimal external knowledge and model adaptation.
- **RAG** is like giving a model a tailored textbook for information retrieval; it is suited to precise information retrieval tasks. It excels in dynamic environments because it updates knowledge in real time, uses external knowledge effectively, and is interpretable. Its drawbacks are higher latency and ethical concerns about data retrieval.
- **FT** is like a student internalizing knowledge over time; it suits tasks requiring reproduction of specific structures, styles, or formats. It is static and requires retraining for updates, but it allows deep customization. It demands significant computational resources for dataset preparation and training, and although it can reduce hallucinations, it may struggle with unfamiliar data.

In evaluations across knowledge-intensive tasks, [28] found that unsupervised fine-tuning offers some improvement, but RAG consistently outperforms it on both existing knowledge seen during training and entirely new knowledge. LLMs also struggle to learn new factual information through unsupervised fine-tuning. The choice between RAG and FT depends on data dynamics, customization needs, and computational capacity. They are not mutually exclusive and can complement each other; in some cases, their combination gives optimal performance, though the optimization process may require multiple iterations.

# III. Retrieval

Efficient retrieval of relevant documents from the data source is crucial in RAG. Key issues include retrieval source, retrieval granularity, retrieval preprocessing, and the embedding model.

## A. Retrieval Source

RAG depends on external knowledge, and both the retrieval source type and retrieval unit granularity affect generation.

### 1) Data Structure

Text is the mainstream retrieval source. Later, retrieval expanded to semi-structured data (PDF) and structured data (Knowledge Graph, KG) for enhancement. Beyond original external sources, recent research also uses content generated by LLMs themselves for retrieval and enhancement.

Unstructured data, especially text, is the most widely used retrieval source and is mainly gathered from corpora. For open-domain question answering (ODQA), primary retrieval sources include Wikipedia Dump, with current major versions including HotpotQA 4 (1st October, 2017) and DPR 5 (20 December, 2018). Other common unstructured data include cross-lingual text [19] and domain-specific data such as medical [67] and legal [29].

Semi-structured data typically combines text and table information, such as PDF. It is challenging for conventional RAG because text splitting may separate tables and corrupt data during retrieval, and tables complicate semantic similarity search. One approach is to use LLM code abilities for Text-2-SQL queries on tables in databases, such as TableGPT [85]. Another is to transform tables into text for analysis using text-based methods [75]. The paper notes that neither is optimal, leaving substantial research opportunities.

Structured data such as knowledge graphs (KGs) [86] are typically verified and can provide more precise information. KnowledGPT [15] generates KB search queries and stores knowledge in a personalized base to enrich RAG knowledge. Because LLMs struggle to understand and answer questions about textual graphs, G-Retriever [84] integrates Graph Neural Networks (GNNs), LLMs, and RAG, improves graph comprehension and question answering through soft prompting of the LLM, and uses the Prize-Collecting Steiner Tree (PCST) optimization problem for targeted …