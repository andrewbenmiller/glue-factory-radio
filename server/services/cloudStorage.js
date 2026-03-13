const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');

class CloudStorageService {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';

    // Optional key prefix for environment isolation (e.g., "staging/" keeps staging files separate)
    this.keyPrefix = process.env.R2_KEY_PREFIX || '';

    if (this.isProduction) {
      this._createS3Client();
      this.bucketName = process.env.S3_BUCKET_NAME;
    }
  }

  // Create a fresh S3 client (called on init and after connection failures)
  _createS3Client() {
    this.s3Client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  // Send an S3 command with a timeout; recreate the client on failure
  async _send(command, timeoutMs = 15000) {
    try {
      return await this.s3Client.send(command, {
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      // Recreate client on timeout/network errors to clear stale connections
      if (err.name === 'TimeoutError' || err.name === 'AbortError' || err.code === 'ECONNRESET') {
        console.warn('S3 connection error, recreating client:', err.message);
        this._createS3Client();
      }
      throw err;
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

      await this._send(new PutObjectCommand(uploadParams), 60000);

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
      await this._send(new DeleteObjectCommand({
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
