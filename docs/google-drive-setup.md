# Setting Up Google Drive Integration

This document provides instructions on how to set up the Google Drive integration for the Trade Tracker feature.

## Creating a Google API Client ID

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - In the sidebar, click on "APIs & Services" > "Library"
   - Search for "Google Drive API" and click on it
   - Click "Enable"
4. Create credentials:
   - In the sidebar, click on "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application" as the application type
   - Set a name for the OAuth client ID (e.g., "Trading Stats Dashboard")
   - Add authorized JavaScript origins:
     - For development: `http://localhost:3000`
     - For production: Add your production URL
   - Add authorized redirect URIs:
     - For development: `http://localhost:3000`
     - For production: Add your production URL
   - Click "Create"
5. Copy the Client ID (you'll need this for the application)

## Configuring the Application

1. Open the file `src/components/TradeTracker.tsx`
2. Replace the placeholder value for `GOOGLE_API_CLIENT_ID` with your actual Client ID:

```typescript
const GOOGLE_API_CLIENT_ID = 'YOUR_ACTUAL_CLIENT_ID_HERE';
```

## Testing the Integration

1. Start the application
2. Navigate to the Options Earnings Screener > Trade Tracker tab
3. Click "Sign in with Google"
4. Grant the necessary permissions
5. Use the "Browse Google Drive" button to select a spreadsheet
6. The selected spreadsheet should be displayed and editable within the application

## Troubleshooting

If you encounter issues with the Google Drive integration:

1. Check the browser console for error messages
2. Verify that the Google Drive API is enabled for your project
3. Ensure that the Client ID is correctly configured
4. Check that the authorized JavaScript origins and redirect URIs are properly set
5. Make sure you're using a supported browser (Chrome, Firefox, Edge, Safari)

## Security Considerations

- The application only requests the minimum necessary permissions (`https://www.googleapis.com/auth/drive.file`)
- This scope only allows the application to view and manage files that the user has explicitly opened or created with the app
- The application does not store any user credentials or tokens on the server
- All authentication is handled client-side through the Google OAuth flow