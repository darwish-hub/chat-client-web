import { useState, useRef, useCallback } from 'react';
import { uploadFile, uploadFromUrl } from '../api/upload';

export default function FileUploader({ onUpload, conversationId }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [urlInput, setUrlInput] = useState('');
  const inputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => processFile(file));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => processFile(file));
    e.target.value = ''; // reset
  };

  const processFile = (file) => {
    const id = Math.random().toString(36).slice(2);
    setUploads((prev) => [...prev, { id, fileName: file.name, progress: 0, status: 'uploading' }]);

    uploadFile(
      file,
      (percent) => {
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress: percent } : u)));
      }
    )
      .then((result) => {
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress: 100, status: 'done', result } : u)));
        onUpload?.(result);
      })
      .catch((err) => {
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'error', error: err.message } : u)));
      });
  };

  const handleUrlUpload = async () => {
    if (!urlInput.trim()) return;
    const id = Math.random().toString(36).slice(2);
    setUploads((prev) => [...prev, { id, fileName: urlInput, progress: 0, status: 'uploading' }]);

    try {
      const result = await uploadFromUrl(urlInput, (percent) => {
        setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress: percent } : u)));
      });
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, progress: 100, status: 'done', result } : u)));
      onUpload?.(result);
      setUrlInput('');
    } catch (err) {
      setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'error', error: err.message } : u)));
    }
  };

  const removeUpload = (id) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="file-uploader">
      <div
        className={`file-dropzone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <div className="file-dropzone-text">
          <span className="file-dropzone-icon">📎</span>
          <p>Drop files here or click to browse</p>
        </div>
      </div>

      <div className="file-url-upload">
        <input
          type="text"
          placeholder="Or paste a URL to upload..."
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          className="file-url-input"
        />
        <button onClick={handleUrlUpload} disabled={!urlInput.trim()} className="file-url-btn">
          Upload URL
        </button>
      </div>

      {uploads.length > 0 && (
        <div className="file-uploads-list">
          {uploads.map((upload) => (
            <div key={upload.id} className={`file-upload-item file-upload-${upload.status}`}>
              <div className="file-upload-info">
                <span className="file-upload-name">{upload.fileName}</span>
                {upload.status === 'uploading' && (
                  <span className="file-upload-percent">{upload.progress}%</span>
                )}
                {upload.status === 'done' && <span className="file-upload-done">✓ Done</span>}
                {upload.status === 'error' && (
                  <span className="file-upload-error">✗ {upload.error}</span>
                )}
              </div>
              {upload.status === 'uploading' && (
                <div className="file-upload-progress">
                  <div
                    className="file-upload-progress-bar"
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
              )}
              <button className="file-upload-remove" onClick={() => removeUpload(upload.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
