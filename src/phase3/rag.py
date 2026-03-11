"""
Sistema RAG — Retrieval Augmented Generation con ChromaDB.
Urban Intelligence Platform - Fase 4

Carga documentos sobre urbanismo, estándares internacionales y LULC
en una base de datos vectorial para que el agente pueda consultarlos.

Uso:
    from phase3.rag import RAGService
    rag = RAGService("docs/knowledge")
    results = rag.search("estándares de áreas verdes ONU-Habitat")
"""
import os
from pathlib import Path
from typing import List, Dict
from langchain_community.document_loaders import TextLoader, DirectoryLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings


# Directorio donde se almacena la base de datos vectorial
CHROMA_DIR = "data/chroma_db"


class RAGService:
    """Servicio de búsqueda semántica sobre documentos urbanos."""

    def __init__(self, docs_dir: str = "docs/knowledge", persist_dir: str = CHROMA_DIR):
        """
        Inicializa el servicio RAG.

        Args:
            docs_dir: Carpeta con los documentos .txt de conocimiento
            persist_dir: Carpeta donde se guarda la base de datos ChromaDB
        """
        self.docs_dir = Path(docs_dir)
        self.persist_dir = persist_dir

        # Usar embeddings locales (gratuitos, no requieren API)
        print("Cargando modelo de embeddings...")
        self.embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
            model_kwargs={"device": "cpu"}
        )

        # Cargar o crear la base de datos vectorial
        if Path(persist_dir).exists() and any(Path(persist_dir).iterdir()):
            print("Cargando base de datos vectorial existente...")
            self.vectorstore = Chroma(
                persist_directory=persist_dir,
                embedding_function=self.embeddings
            )
            print(f"Base de datos cargada: {self.vectorstore._collection.count()} fragmentos")
        else:
            print("Creando nueva base de datos vectorial...")
            self._build_vectorstore()

    def _build_vectorstore(self):
        """Carga documentos, los divide en fragmentos y crea la base vectorial."""
        if not self.docs_dir.exists():
            print(f"Advertencia: No se encontró la carpeta {self.docs_dir}")
            self.vectorstore = None
            return

        # Cargar todos los .txt de la carpeta
        documents = []
        for txt_file in sorted(self.docs_dir.glob("*.txt")):
            loader = TextLoader(str(txt_file), encoding="utf-8")
            documents.extend(loader.load())
            print(f"  Cargado: {txt_file.name}")

        if not documents:
            print("No se encontraron documentos.")
            self.vectorstore = None
            return

        # Dividir en fragmentos para búsqueda granular
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=150,
            separators=["\n===", "\n\n", "\n", ". ", " "]
        )
        chunks = splitter.split_documents(documents)
        print(f"  Total de fragmentos: {len(chunks)}")

        # Crear base de datos vectorial
        self.vectorstore = Chroma.from_documents(
            documents=chunks,
            embedding=self.embeddings,
            persist_directory=self.persist_dir
        )
        print(f"Base de datos creada con {len(chunks)} fragmentos")

    def search(self, query: str, k: int = 4) -> List[Dict]:
        """
        Busca los fragmentos más relevantes para una consulta.

        Args:
            query: Pregunta o tema a buscar
            k: Número de resultados a devolver

        Returns:
            Lista de diccionarios con 'content' y 'source'
        """
        if self.vectorstore is None:
            return [{"content": "Base de datos no disponible.", "source": "N/A"}]

        results = self.vectorstore.similarity_search(query, k=k)

        return [
            {
                "content": doc.page_content,
                "source": Path(doc.metadata.get("source", "desconocido")).name
            }
            for doc in results
        ]

    def search_text(self, query: str, k: int = 4) -> str:
        """
        Busca y devuelve los resultados como texto formateado.
        Útil para pasar directamente al LLM como contexto.
        """
        results = self.search(query, k=k)
        if not results:
            return "No se encontró información relevante."

        text_parts = []
        for i, r in enumerate(results, 1):
            text_parts.append(
                f"[Fragmento {i} — {r['source']}]\n{r['content']}"
            )
        return "\n\n".join(text_parts)

    def rebuild(self):
        """Reconstruye la base de datos vectorial desde cero."""
        import shutil
        if Path(self.persist_dir).exists():
            shutil.rmtree(self.persist_dir)
        self._build_vectorstore()
