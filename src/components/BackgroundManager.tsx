import React, { useState, useEffect } from 'react';
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
  const [currentImage, setCurrentImage] = useState<BackgroundImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBackgroundImages = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('https://glue-factory-radio-production.up.railway.app/api/upload/background-images');

      if (!response.ok) {
        throw new Error(`Failed to fetch background images: ${response.status}`);
      }

      const images: BackgroundImage[] = await response.json();
      const activeImages = images.filter(img => img.is_active);

      if (activeImages.length > 0) {
        setCurrentImage(activeImages[0]);
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
        zIndex: -1
      }}
    />
  );
};

export default BackgroundManager;
