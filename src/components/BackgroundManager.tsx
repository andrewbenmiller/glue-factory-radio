import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import './BackgroundManager.css';

interface BackgroundImage {
  id: number;
  filename: string;
  original_name: string;
  file_size: number;
  upload_date: string;
  is_active: boolean;
  url: string;
}

interface BackgroundManagerProps {
  className?: string;
}

const BackgroundManager: React.FC<BackgroundManagerProps> = ({ className = '' }) => {
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
  const [currentImage, setCurrentImage] = useState<BackgroundImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch background images from the backend
  const fetchBackgroundImages = async () => {
    try {
      console.log('🖼️ Fetching background images...');
      setIsLoading(true);
      const response = await fetch('https://glue-factory-radio-production.up.railway.app/api/upload/background-images');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch background images: ${response.status}`);
      }
      
      const images: BackgroundImage[] = await response.json();
      console.log('🖼️ Received images:', images);
      
      const activeImages = images.filter(img => img.is_active);
      console.log('🖼️ Active images:', activeImages);
      
      setBackgroundImages(activeImages);
      
      // Use the first image from the backend (no random selection)
      if (activeImages.length > 0) {
        const selectedImage = activeImages[0];
        console.log('🖼️ Selected image:', selectedImage);
        setCurrentImage(selectedImage);
      } else {
        console.log('🖼️ No active images found');
      }
    } catch (error) {
      console.error('Error fetching background images:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load background images on component mount
  useEffect(() => {
    fetchBackgroundImages();
  }, []);


  // Show loading indicator
  if (isLoading) {
    return (
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        zIndex: 9999
      }}>
        🖼️ Loading backgrounds...
      </div>
    );
  }

  // Show no images message
  if (!currentImage) {
    return (
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        zIndex: 9999
      }}>
        🖼️ No background images found
      </div>
    );
  }

  return (
    <div 
      className={`background-manager ${className}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundImage: `url(${currentImage.url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        zIndex: -1
      }}
    />
  );
};

export default BackgroundManager;
