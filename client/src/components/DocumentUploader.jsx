import { useState, useRef } from 'react';
import { FileText, ChevronUp, ChevronDown, Paperclip, X } from 'lucide-react';

export default function DocumentUploader({ documents, onUpload, onDelete, isLoading }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef(null);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError('');
    setIsUploading(true);

    try {
      await onUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setUploadError(err.message || 'File upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  return (
    <div className="document-uploader-card">
      <div className="uploader-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="uploader-title">
          <FileText className="doc-icon w-4 h-4 text-brand-600" />
          <div>
            <strong>Attached Research Documents</strong>
            <span className="doc-counter">({documents.length} available for grounding)</span>
          </div>
        </div>
        <button
          type="button"
          className="toggle-expand-btn flex items-center gap-1"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? 'Collapse' : 'Manage Docs'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="uploader-body">
          <div className="uploader-drop-area">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              style={{ display: 'none' }}
              disabled={isUploading || isLoading}
            />
            <button
              type="button"
              className="button secondary upload-browse-btn flex items-center gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isLoading}
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Extracting & chunking…' : 'Attach PDF, DOCX, or TXT'}</span>
            </button>
            <span className="uploader-hint">
              Documents are indexed by page and cited alongside live web evidence.
            </span>
          </div>

          {uploadError && <div className="upload-error-msg">{uploadError}</div>}

          {documents.length > 0 && (
            <div className="doc-chip-list">
              {documents.map((doc) => (
                <div key={doc.id} className="doc-chip">
                  <span className="doc-chip-name flex items-center gap-1" title={doc.filename}>
                    <FileText className="w-3 h-3 text-brand-600" />
                    <span>{doc.filename}</span>
                  </span>
                  <span className="doc-chip-meta">
                    {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'} · {formatBytes(doc.file_size)}
                  </span>
                  <button
                    type="button"
                    className="doc-chip-del"
                    onClick={() => onDelete(doc.id)}
                    title="Remove document"
                    disabled={isLoading || isUploading}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

