# 🚂 Railway Deployment Guide for Glue Factory Radio

## Prerequisites
- [Railway account](https://railway.app/)
- GitHub repository connected to Railway
- Node.js 18+ (Railway will handle this automatically)

## 🚀 Quick Deploy

1. **Fork/Clone this repository** to your GitHub account
2. **Connect to Railway:**
   - Go to [railway.app](https://railway.app/)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

## ⚙️ Environment Variables

Set these in Railway's dashboard under your project's "Variables" tab:

```bash
# Server Configuration
PORT=5001
NODE_ENV=production

# Database Configuration (Railway will provide this)
DB_PATH=./data/radio.db

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# File Upload Configuration
MAX_FILE_SIZE=100MB
UPLOAD_PATH=./uploads

# CORS Configuration (update with your frontend URL)
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

## 🔧 Railway Configuration

The `railway.json` file is already configured with:
- **Builder**: NIXPACKS (automatic Node.js detection)
- **Start Command**: `cd server && npm start`
- **Health Check**: `/api/health`
- **Restart Policy**: Automatic restart on failure

## 📁 File Structure for Railway

```
glue-factory-radio/
├── railway.json          # Railway configuration
├── server/               # Backend code
│   ├── server.js        # Main server file
│   ├── package.json     # Dependencies
│   ├── routes/          # API routes
│   ├── models/          # Database models
│   └── uploads/         # File uploads (persistent)
└── src/                 # Frontend (deploy separately)
```

## 🗄️ Database Considerations

**Current Setup**: SQLite (file-based)
- ✅ Works locally
- ⚠️ Limited in production (file system constraints)

**Recommended Upgrade**: PostgreSQL
- Railway provides managed PostgreSQL
- Better for production workloads
- Automatic backups and scaling

## 📤 File Uploads

Railway provides persistent storage for your `/uploads` directory. Files will persist between deployments.

## 🔍 Health Check

Railway automatically monitors your app at `/api/health`. The endpoint returns:
```json
{
  "status": "OK",
  "message": "Glue Factory Radio Server is running!",
  "timestamp": "2025-08-13T15:58:03.000Z"
}
```

## 🚨 Troubleshooting

### Common Issues:

1. **Port conflicts**: Railway sets `PORT` automatically
2. **Database errors**: Check `DB_PATH` and file permissions
3. **CORS issues**: Verify `CORS_ORIGIN` matches your frontend URL
4. **File uploads**: Ensure `UPLOAD_PATH` is writable

### Logs:
- Check Railway dashboard for deployment logs
- Monitor the `/api/health` endpoint
- Review server console output

## 🔄 Updating Your App

1. **Push changes** to your GitHub repository
2. **Railway automatically redeploys** (if auto-deploy is enabled)
3. **Manual redeploy** from Railway dashboard if needed

## 🌐 Frontend Integration

After deploying the backend to Railway:
1. Update your frontend's API base URL to your Railway domain
2. Deploy frontend to Vercel/Netlify
3. Update `CORS_ORIGIN` in Railway environment variables

## 📊 Monitoring

Railway provides:
- **Uptime monitoring** via health checks
- **Performance metrics** and logs
- **Automatic scaling** based on demand
- **SSL certificates** included

---

**Next Steps:**
1. Deploy to Railway using the guide above
2. Test the `/api/health` endpoint
3. Update frontend to use Railway backend URL
4. Deploy frontend to Vercel

Need help? Check Railway's [documentation](https://docs.railway.app/) or [community](https://community.railway.app/)!
