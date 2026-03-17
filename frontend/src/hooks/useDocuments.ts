import { useState, useEffect } from 'react';
import { documentService } from '../services/documentService';
import type { UseDocumentsReturn } from '../types';

export function useDocuments(): UseDocumentsReturn {
  const [documents, setDocuments] = useState<string[]>([]);
  const [currentDocument, setCurrentDocument] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await documentService.list();
      setDocuments(docs);
      if (docs.length > 0 && !currentDocument) {
        setCurrentDocument(docs[0]);
      }
    } catch (err) {
      setError((err as Error).message);
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectDocument = (docName: string) => {
    setCurrentDocument(docName);
  };

  return {
    documents,
    currentDocument,
    selectDocument,
    loading,
    error,
    reload: loadDocuments,
  };
}