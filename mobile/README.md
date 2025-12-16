# Glue Factory Radio Mobile

iOS/Android app for Glue Factory Radio built with Expo and React Native.

## Setup

1. Install dependencies:
```bash
cd mobile
npm install
```

2. Start the Expo development server:
```bash
npx expo start
```

3. Run on your device:
   - **iOS**: Press `i` in the terminal or scan the QR code with the Camera app
   - **Android**: Press `a` in the terminal or scan the QR code with the Expo Go app

## Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root layout
│   ├── index.tsx          # Shows list screen
│   └── show/[id].tsx      # Show detail screen
├── src/
│   ├── components/        # Reusable components
│   │   ├── AudioPlayer.tsx
│   │   ├── ShowItem.tsx
│   │   └── TrackItem.tsx
│   ├── screens/           # Screen components
│   │   ├── ShowsScreen.tsx
│   │   └── ShowDetailScreen.tsx
│   ├── services/          # API service
│   │   └── api.ts
│   └── types/             # TypeScript types
│       └── index.ts
├── package.json
└── app.json
```

## Features

- Browse all shows from the backend
- View tracks for each show
- Play audio tracks with basic play/pause controls
- Audio continues playing when navigating between screens

## API

The app connects to the Railway backend at:
`https://glue-factory-radio-production.up.railway.app/api/shows`

## Development

- Uses Expo Router for navigation
- TypeScript for type safety
- Expo AV for audio playback
- Matches backend API structure exactly

