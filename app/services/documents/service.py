"""Document management service."""

import os
from typing import List, Dict, Any, Optional
from supabase import Client
from app.services.pdf_processor.processor import PDFProcessor
from app.services.embedding import EmbeddingService
from app.services.storage import StorageService
from app.services.rag.cache_registry import delete_cache_entries_for_document
from app.db.repository import DocumentRepository
from app.db.processing_status import get_processing_status_repository


class DocumentService:
    """Service for managing documents with Supabase Storage integration."""

    def __init__(
        self,
        supabase_client: Client,
        embedding_service: EmbeddingService,
        doc_repository: DocumentRepository,
        pdf_processor: PDFProcessor,
        storage_bucket: str = "pdfs"
    ):
        """
        Initialize document service.

        Args:
            supabase_client: Supabase client instance
            embedding_service: Service for generating embeddings
            doc_repository: Repository for document chunks
            pdf_processor: Service for processing PDFs
            storage_bucket: Supabase storage bucket name
        """
        self.supabase_client = supabase_client
        self.embedding_service = embedding_service
        self.doc_repository = doc_repository
        self.pdf_processor = pdf_processor
        self.storage_bucket = storage_bucket

    def list_documents(self) -> List[str]:
        """
        List all documents in the database.

        Returns:
            List of document names
        """
        return self.doc_repository.list_documents()

    def list_document_summaries(self) -> List[Dict[str, Any]]:
        """
        List admin-facing document summaries without exposing embedded chunks.

        Returns:
            List of document summaries
        """
        return self.doc_repository.list_document_summaries()

    def get_document_content(self, document_name: str) -> Dict[str, Any]:
        """
        Read the full extracted content for a document.

        Args:
            document_name: Name of the document to read

        Returns:
            Document content and file metadata

        Raises:
            ValueError: If document doesn't exist
        """
        chunks = self.doc_repository.get_chunks_by_name(document_name)
        if not chunks:
            raise ValueError(f"Document '{document_name}' not found")

        chunks = sorted(chunks, key=lambda chunk: chunk.get("chunk_id", 0))
        first_metadata = next(
            (chunk.get("metadata") for chunk in chunks if isinstance(chunk.get("metadata"), dict)),
            {},
        )
        pages = sorted({
            page
            for chunk in chunks
            for page in (chunk.get("pages") or [])
            if isinstance(page, int)
        })

        return {
            "document_name": document_name,
            "content": "\n\n".join(chunk.get("content", "") for chunk in chunks if chunk.get("content")),
            "chunks_count": len(chunks),
            "storage_path": first_metadata.get("storage_path") if isinstance(first_metadata, dict) else None,
            "public_url": first_metadata.get("public_url") if isinstance(first_metadata, dict) else None,
            "pages": pages,
        }

    def upload_document(
        self,
        file_path: str,
        document_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Upload and process a document from any file path.

        Args:
            file_path: Absolute path to the PDF file
            document_name: Optional custom document name (defaults to filename without extension)

        Returns:
            Dictionary with upload results including storage path and chunks processed

        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If file is not a PDF
        """
        # Validate file exists
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        # Validate PDF file
        if not file_path.lower().endswith('.pdf'):
            raise ValueError("Only PDF files are supported")

        # Determine document name
        if document_name is None:
            document_name = os.path.basename(file_path).replace('.pdf', '')

        # Upload to Supabase Storage
        storage_path = StorageService.sanitize_storage_path(f"{document_name}.pdf")

        with open(file_path, 'rb') as f:
            file_data = f.read()

        # Upload to Supabase Storage
        try:
            self.supabase_client.storage.from_(self.storage_bucket).upload(
                path=storage_path,
                file=file_data,
                file_options={"content-type": "application/pdf"}
            )
        except Exception as e:
            # If file already exists, update it
            if "already exists" in str(e).lower():
                self.supabase_client.storage.from_(self.storage_bucket).update(
                    path=storage_path,
                    file=file_data,
                    file_options={"content-type": "application/pdf"}
                )
            else:
                raise

        # Get public URL
        public_url = self.supabase_client.storage.from_(self.storage_bucket).get_public_url(storage_path)

        # Process PDF and create semantic chunks with page metadata
        markdown_content, pdf_metadata = self.pdf_processor.process_pdf(file_path)
        chunks = self.pdf_processor.chunk_text_with_pages(markdown_content, pdf_metadata)

        embedded_chunks = []
        for i, chunk in enumerate(chunks):
            chunk_text = chunk.get("text", "")
            embedding = self.embedding_service.embed_text(chunk_text)
            embedded_chunks.append({
                "chunk_id": i,
                "content": chunk_text,
                "embedding": embedding,
                "metadata": {
                    **chunk.get('metadata', {}),
                    'storage_path': storage_path,
                    'public_url': public_url
                },
                "pages": chunk.get('pages'),
                "page_range": chunk.get('page_range')
            })

        # Keep each file and its embedded content as one replaceable unit.
        if document_name in self.doc_repository.list_documents():
            self.doc_repository.delete_by_name(document_name)
            delete_cache_entries_for_document(document_name)

        # Store chunks with embeddings
        for chunk in embedded_chunks:
            self.doc_repository.insert_chunk(
                document_name=document_name,
                chunk_id=chunk["chunk_id"],
                content=chunk["content"],
                embedding=chunk["embedding"],
                metadata=chunk["metadata"],
                pages=chunk["pages"],
                page_range=chunk["page_range"]
            )

        return {
            "document_name": document_name,
            "chunks_processed": len(chunks),
            "storage_path": storage_path,
            "public_url": public_url
        }

    def upload_from_bytes(
        self,
        file_content: bytes,
        filename: str,
        document_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Upload and process a document from file bytes (for file uploads).

        Args:
            file_content: PDF file content as bytes
            filename: Original filename
            document_name: Optional custom document name

        Returns:
            Dictionary with upload results
        """
        # Create temporary file
        import tempfile

        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name

        try:
            # Use the main upload method
            if document_name is None:
                document_name = filename.replace('.pdf', '')

            result = self.upload_document(tmp_path, document_name)
            return result
        finally:
            # Clean up temporary file
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def delete_document(self, document_name: str) -> bool:
        """
        Delete a document and all its chunks.

        Args:
            document_name: Name of the document to delete

        Returns:
            True if successful

        Raises:
            ValueError: If document doesn't exist
        """
        # Check if document exists
        documents = self.doc_repository.list_documents()
        if document_name not in documents:
            raise ValueError(f"Document '{document_name}' not found")

        chunks = self.doc_repository.get_chunks_by_name(document_name)
        storage_paths = []
        for chunk in chunks:
            metadata = chunk.get("metadata")
            if isinstance(metadata, dict) and metadata.get("storage_path"):
                storage_paths.append(metadata["storage_path"])

        # Delete embedded chunks from database
        success = self.doc_repository.delete_by_name(document_name)

        if success:
            # Try to delete from storage (best effort)
            try:
                storage_paths.append(StorageService.sanitize_storage_path(f"{document_name}.pdf"))
                unique_paths = sorted(set(storage_paths))
                self.supabase_client.storage.from_(self.storage_bucket).remove(unique_paths)
            except Exception:
                # If storage deletion fails, continue (chunks are already deleted)
                pass

            try:
                status_repo = get_processing_status_repository(self.supabase_client)
                status_repo.delete_status(document_name)
            except Exception:
                pass

            try:
                delete_cache_entries_for_document(document_name)
            except Exception:
                pass

        return success
