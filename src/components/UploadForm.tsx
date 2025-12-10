import React, { useState } from 'react';
import { apiService, UploadResponse } from '../services/api';
import './UploadForm.css';

interface UploadFormProps {
  onUploadSuccess: () => void;
}

const UploadForm: React.FC<UploadFormProps> = ({ onUploadSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!title.trim()) {
      setUploadStatus({ type: 'error', message: 'Please enter a title' });
      return;
    }

    if (!audioFile) {
      setUploadStatus({ type: 'error', message: 'Please select an audio file' });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      const result: UploadResponse = await apiService.uploadShow(title, description, audioFile);
      
      setUploadStatus({
        type: 'success',
        message: `Upload successful! ${result.show.title} has been added.`
      });

      // Reset form
      setTitle('');
      setDescription('');
      setAudioFile(null);
      
      // Notify parent component
      onUploadSuccess();
      
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Upload failed'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="upload-form-container">
      <h3>Upload New Show</h3>
      
      <form onSubmit={handleSubmit} className="upload-form">
        <div className="form-group">
          <label htmlFor="title">Show Title *</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter show title"
            required
            disabled={isUploading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <input
            type="text"
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter show description"
            disabled={isUploading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="audio">Audio File *</label>
          <input
            type="file"
            id="audio"
            onChange={handleFileChange}
            accept="audio/*"
            required
            disabled={isUploading}
          />
          <small>Supported formats: MP3, WAV, OGG, AAC, FLAC (Max: 100MB)</small>
        </div>

        <button 
          type="submit" 
          className="upload-button"
          disabled={isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload Show'}
        </button>
      </form>

      {uploadStatus.type && (
        <div className={`upload-status ${uploadStatus.type}`}>
          {uploadStatus.message}
        </div>
      )}
    </div>
  );
};

export default UploadForm;
