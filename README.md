# 🎵 Glue Factory Radio

An internet radio platform built with React and TypeScript, featuring a smooth MP3 player with show/episode management.

## ✨ Features

- **Full Audio Controls**: Play, pause, skip forward/backward, seek bar
- **Show Management**: Organize content into discrete shows/episodes
- **Auto-play**: Seamlessly transition between shows
- **Cross-platform**: Works on desktop and mobile devices
- **Responsive Design**: Beautiful UI that adapts to any screen size
- **Unique URLs**: Each show can be shared with its own URL

## 🚀 Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone or download this project
2. Navigate to the project directory:
   ```bash
   cd "Glue Factory Radio/glue-factory-radio"
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🎧 How to Use

### Current Features
- **Sample Shows**: The app comes with 3 sample shows for testing
- **Player Controls**: Use the intuitive controls to navigate through shows
- **Auto-play Toggle**: Turn on/off automatic progression between shows
- **Show Selection**: Click on any show in the list to start playing

### Adding Your Own Shows
Currently, the app uses sample MP3 URLs. To add your own content:

1. Upload MP3 files to a hosting service (AWS S3, Google Cloud Storage, etc.)
2. Update the `shows` array in `src/App.tsx` with your show information
3. Each show should have:
   - `id`: Unique identifier
   - `title`: Show name
   - `url`: Direct MP3 file URL
   - `duration`: Length in seconds
   - `description`: Optional show description
   - `uploadDate`: When the show was added

## 🛠️ Tech Stack

- **Frontend**: React 18 with TypeScript
- **Audio Player**: React Player + Howler.js
- **Styling**: CSS3 with modern design patterns
- **Build Tool**: Create React App
- **Deployment**: Ready for Vercel deployment

## 📱 Mobile Support

The app is fully responsive and works great on:
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Tablet devices

## 🚀 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy with one click

### Other Platforms
The app can be deployed to any static hosting service:
- Netlify
- GitHub Pages
- AWS S3 + CloudFront
- Any web server

## 🔮 Future Enhancements

- **Backend Integration**: MP3 upload and management system
- **User Authentication**: Personal playlists and favorites
- **Live Streaming**: Real-time radio broadcasting
- **Analytics**: Track listening statistics
- **Social Features**: Share shows on social media
- **Podcast Support**: RSS feed integration

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests to improve the project.

## 📄 License

This project is open source and available under the MIT License.

---

**Glue Factory Radio** - Bringing the internet radio experience to the modern web! 🎶
# Trigger Railway deployment
