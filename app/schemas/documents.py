"""Document management schemas."""

from pydantic import BaseModel, Field
from typing import List, Optional


class DocumentSummary(BaseModel):
    """Admin-facing document summary without embedded chunks."""

    document_name: str = Field(..., description="Document name")
    chunks_count: int = Field(..., description="Number of embedded chunks")
    storage_path: Optional[str] = Field(None, description="Path in Supabase Storage")
    public_url: Optional[str] = Field(None, description="Public URL to access the file")
    page_count: Optional[int] = Field(None, description="Number of pages detected from chunk metadata")
    created_at: Optional[str] = Field(None, description="Earliest chunk creation timestamp")


class DocumentListResponse(BaseModel):
    """Response model for listing documents."""

    documents: List[str] = Field(..., description="List of document names")
    count: int = Field(..., description="Total number of documents")


class DocumentAdminListResponse(BaseModel):
    """Response model for admin document listing."""

    documents: List[DocumentSummary] = Field(..., description="List of document summaries")
    count: int = Field(..., description="Total number of documents")


class DocumentContentResponse(BaseModel):
    """Response model for reading a document's full extracted content."""

    document_name: str = Field(..., description="Document name")
    content: str = Field(..., description="Full extracted document content")
    chunks_count: int = Field(..., description="Number of chunks used to reconstruct the content")
    storage_path: Optional[str] = Field(None, description="Path in Supabase Storage")
    public_url: Optional[str] = Field(None, description="Public URL to access the file")
    pages: List[int] = Field(default_factory=list, description="Pages detected from chunk metadata")


class DocumentUploadResponse(BaseModel):
    """Response model for document upload."""

    status: str = Field(..., description="Upload status")
    document_name: str = Field(..., description="Name of the uploaded document")
    chunks_processed: int = Field(..., description="Number of chunks created")
    storage_path: str = Field(..., description="Path in Supabase Storage")
    public_url: Optional[str] = Field(None, description="Public URL to access the file")


class DocumentDeleteResponse(BaseModel):
    """Response model for document deletion."""

    status: str = Field(..., description="Deletion status")
    document_name: str = Field(..., description="Name of the deleted document")
    message: str = Field(..., description="Success message")


class DocumentUploadRequest(BaseModel):
    """Request model for document upload from path."""

    file_path: str = Field(..., description="Absolute path to the PDF file")
    document_name: Optional[str] = Field(None, description="Optional custom document name")
