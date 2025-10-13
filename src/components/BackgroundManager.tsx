import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

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
      setIsLoading(true);
      const response = await fetch('https://glue-factory-radio-production.up.railway.app/api/upload/background-images');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch background images: ${response.status}`);
      }
      
      const images: BackgroundImage[] = await response.json();
      const activeImages = images.filter(img => img.is_active);
      
      setBackgroundImages(activeImages);
      
      // Select a random background image
      if (activeImages.length > 0) {
        const randomIndex = Math.floor(Math.random() * activeImages.length);
        setCurrentImage(activeImages[randomIndex]);
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

  // Change background image every 30 seconds
  useEffect(() => {
    if (backgroundImages.length > 1) {
      const interval = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * backgroundImages.length);
        setCurrentImage(backgroundImages[randomIndex]);
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
    }
  }, [backgroundImages]);

  // Don't render anything if loading or no images
  if (isLoading || !currentImage) {
    return null;
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
        zIndex: -1,
        transition: 'background-image 1s ease-in-out'
      }}
    />
  );
};

export default BackgroundManager;
