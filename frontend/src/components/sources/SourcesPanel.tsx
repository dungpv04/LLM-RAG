import { FileText, Loader2 } from 'lucide-react';
import { SourceCard } from './SourceCard';
import { SourcesSkeleton } from './SourcesSkeleton';

interface SourcesPanelProps {
  documents: string[];
  currentDocument: string | null;
  onSelectDocument: (doc: string) => void;
  loading: boolean;
}

export function SourcesPanel({ documents, currentDocument, onSelectDocument, loading }: SourcesPanelProps) {
  return (
    <aside className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-200 dark:border-gray-800">
        <FileText className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <h2 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
          Documents
        </h2>
        {loading && (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin ml-auto" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {loading ? (
          <SourcesSkeleton count={5} />
        ) : documents.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
              <FileText className="w-6 h-6 text-gray-400 dark:text-gray-600" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No documents available
            </p>
          </div>
        ) : (
          documents.map((doc, index) => (
            <SourceCard
              key={doc}
              document={doc}
              isSelected={doc === currentDocument}
              onSelect={() => onSelectDocument(doc)}
              index={index}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {!loading && documents.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'} loaded
          </p>
        </div>
      )}
    </aside>
  );
}