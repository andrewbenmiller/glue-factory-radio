const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');

class CloudStorageService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    
    // Optional key prefix for environment isolation (e.g., "staging/" keeps staging files separate)
    this.keyPrefix = process.env.R2_KEY_PREFIX || '';

    if (this.isProduction) {
      // Production: Use Cloudflare R2 or AWS S3
      this.s3Client = new S3Client({
        region: process.env.S3_REGION || 'auto',
        endpoint: process.env.S3_ENDPOINT, // For Cloudflare R2: https://account-id.r2.cloudflarestorage.com
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true, // Required for some S3-compatible services
      });

      this.bucketName = process.env.S3_BUCKET_NAME;
    }
  }

  // Upload file to cloud storage
  async uploadFile(filePath, fileName, contentType = 'audio/mpeg') {
    if (!this.isProduction) {
      // Development: Return local file path
      return {
        success: true,
        url: `/uploads/${fileName}`,
        key: fileName,
        message: 'File stored locally for development'
      };
    }

    try {
      const fileStream = fs.createReadStream(filePath);
      const key = `${this.keyPrefix}uploads/${fileName}`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: fileStream,
        ContentType: contentType,
        ACL: 'public-read', // Make file publicly accessible
      };

      await this.s3Client.send(new PutObjectCommand(uploadParams));

      // Generate public URL
      const publicUrl = `${process.env.S3_PUBLIC_URL}/${key}`;

      return {
        success: true,
        url: publicUrl,
        key: key,
        message: 'File uploaded to cloud storage successfully'
      };
    } catch (error) {
      console.error('Error uploading to cloud storage:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to upload file to cloud storage'
      };
    }
  }

  // Get signed URL for private files (if needed)
  async getSignedUrl(key, expiresIn = 3600) {
    if (!this.isProduction) {
      return `/uploads/${key}`;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
  }

  // Delete file from cloud storage
  async deleteFile(key) {
    if (!this.isProduction) {
      // Development: Delete local file
      const localPath = `./uploads/${key}`;
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
      return { success: true, message: 'Local file deleted' };
    }

    try {
      await this.s3Client.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));

      return {
        success: true,
        message: 'File deleted from cloud storage successfully'
      };
    } catch (error) {
      console.error('Error deleting from cloud storage:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to delete file from cloud storage'
      };
    }
  }

  // Check if cloud storage is configured
  isConfigured() {
    if (!this.isProduction) {
      return true; // Always configured for local development
    }

    return !!(
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET_NAME &&
      process.env.S3_ENDPOINT
    );
  }
}

module.exports = new CloudStorageService();
