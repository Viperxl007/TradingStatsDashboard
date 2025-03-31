import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Heading,
  Text,
  Spinner,
  Center,
  Button,
  Link,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useColorMode,
  VStack,
  HStack,
  Icon
} from '@chakra-ui/react';
import { FiFile, FiFolder, FiExternalLink } from 'react-icons/fi';

// Google API Client ID - This should be replaced with your actual client ID
// You would need to create a project in Google Cloud Console and enable the Drive API
const GOOGLE_API_CLIENT_ID = '926661064819-q9gnet86mfj72rtdjkvol23vhs0sg78i.apps.googleusercontent.com';
const GOOGLE_API_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/**
 * TradeTracker Component
 * 
 * This component provides access to Google Drive for tracking trades.
 * It allows users to browse their Google Drive, find a spreadsheet, and edit it directly within the application.
 */
const TradeTracker: React.FC = () => {
  const { colorMode } = useColorMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ id: string; name: string } | null>(null);
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);
  const [driveApiLoaded, setDriveApiLoaded] = useState(false);

  // Load the Google API client and auth libraries
  useEffect(() => {
    // Function to load Google API client
    const loadGoogleApi = () => {
      // Check if the script is already loaded
      if (document.getElementById('google-api-script')) {
        return;
      }

      // Create script element
      const script = document.createElement('script');
      script.id = 'google-api-script';
      script.src = 'https://apis.google.com/js/api.js';
      script.async = true;
      script.defer = true;
      
      // Handle script load
      script.onload = () => {
        // Load the auth2 library
        window.gapi.load('auth2', () => {
          window.gapi.auth2.init({
            client_id: GOOGLE_API_CLIENT_ID,
            scope: GOOGLE_API_SCOPE
          }).then(() => {
            console.log('Google Auth initialized');
            // Check if user is already signed in
            const authInstance = window.gapi.auth2.getAuthInstance();
            setIsAuthenticated(authInstance.isSignedIn.get());
            
            // Listen for sign-in state changes
            authInstance.isSignedIn.listen((isSignedIn: boolean) => {
              setIsAuthenticated(isSignedIn);
            });
            
            // Load the picker API
            window.gapi.load('picker', () => {
              setPickerApiLoaded(true);
              console.log('Google Picker API loaded');
            });
            
            // Load the client library
            window.gapi.load('client', () => {
              window.gapi.client.load('drive', 'v3', () => {
                setDriveApiLoaded(true);
                console.log('Google Drive API loaded');
              });
            });
            
            setIsLoading(false);
          }).catch((error: any) => {
            console.error('Error initializing Google Auth:', error);
            setError('Failed to initialize Google authentication. Please try again later.');
            setIsLoading(false);
          });
        });
      };
      
      // Handle script error
      script.onerror = () => {
        setError('Failed to load Google API. Please check your internet connection or try again later.');
        setIsLoading(false);
      };
      
      // Add script to document
      document.head.appendChild(script);
    };
    
    loadGoogleApi();
    
    // Cleanup function
    return () => {
      // Nothing to clean up
    };
  }, []);

  // Function to handle Google Sign In
  const handleSignIn = () => {
    if (!window.gapi || !window.gapi.auth2) {
      setError('Google API not loaded. Please refresh the page and try again.');
      return;
    }
    
    const authInstance = window.gapi.auth2.getAuthInstance();
    authInstance.signIn().then(
      () => {
        setIsAuthenticated(true);
        setError(null);
      },
      (error: any) => {
        console.error('Error signing in:', error);
        setError('Failed to sign in to Google. Please try again.');
      }
    );
  };

  // Function to handle Google Sign Out
  const handleSignOut = () => {
    if (!window.gapi || !window.gapi.auth2) {
      return;
    }
    
    const authInstance = window.gapi.auth2.getAuthInstance();
    authInstance.signOut().then(
      () => {
        setIsAuthenticated(false);
        setSelectedFile(null);
      },
      (error: any) => {
        console.error('Error signing out:', error);
      }
    );
  };

  // Function to open Google Picker
  const openPicker = () => {
    if (!pickerApiLoaded || !isAuthenticated) {
      setError('Google Picker API not loaded or user not authenticated.');
      return;
    }
    
    const authInstance = window.gapi.auth2.getAuthInstance();
    const user = authInstance.currentUser.get();
    const oauthToken = user.getAuthResponse().access_token;
    
    if (!oauthToken) {
      setError('Failed to get OAuth token. Please sign in again.');
      return;
    }
    
    // Create a new picker
    const picker = new window.google.picker.PickerBuilder()
      .addView(new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setMimeTypes('application/vnd.google-apps.spreadsheet')
        .setSelectFolderEnabled(false))
      .setOAuthToken(oauthToken)
      .setDeveloperKey(GOOGLE_API_CLIENT_ID)
      .setCallback(pickerCallback)
      .setTitle('Select a spreadsheet')
      .build();
    
    picker.setVisible(true);
  };

  // Callback function for the picker
  const pickerCallback = (data: any) => {
    if (data.action === window.google.picker.Action.PICKED) {
      const document = data.docs[0];
      setSelectedFile({
        id: document.id,
        name: document.name
      });
    }
  };

  // Render the Google Drive file in an iframe
  const renderFile = () => {
    if (!selectedFile) {
      return null;
    }
    
    const fileUrl = `https://docs.google.com/spreadsheets/d/${selectedFile.id}/edit?usp=sharing&embedded=true`;
    
    return (
      <Box height="800px" borderWidth="1px" borderRadius="lg" overflow="hidden">
        <Box p={4} borderBottomWidth="1px" bg={colorMode === 'dark' ? 'gray.700' : 'gray.50'}>
          <Text fontWeight="bold">{selectedFile.name}</Text>
        </Box>
        <iframe
          src={fileUrl}
          width="100%"
          height="calc(100% - 53px)"
          style={{ border: 'none' }}
          title="Google Drive File"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </Box>
    );
  };

  // Render the component
  return (
    <Box>
      <Box mb={6}>
        <Heading size="md" mb={4}>Trade Tracker</Heading>
        <Text mb={4}>
          Access your Google Drive to find and edit your trade tracking spreadsheet directly within this application.
        </Text>
      </Box>
      
      {isLoading && (
        <Center height="400px" borderWidth="1px" borderRadius="lg">
          <VStack spacing={4}>
            <Spinner size="xl" color="brand.500" />
            <Text>Loading Google Drive integration...</Text>
          </VStack>
        </Center>
      )}
      
      {error && (
        <Alert status="error" borderRadius="md" mb={6}>
          <AlertIcon />
          <Box>
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Box>
        </Alert>
      )}
      
      {!isLoading && !error && (
        <>
          {!isAuthenticated ? (
            <Center height="400px" borderWidth="1px" borderRadius="lg">
              <VStack spacing={6}>
                <Icon as={FiFolder} boxSize={12} color="gray.400" />
                <Text fontSize="lg">Sign in to access your Google Drive</Text>
                <Button
                  colorScheme="brand"
                  size="lg"
                  onClick={handleSignIn}
                  leftIcon={<Icon as={FiExternalLink} />}
                >
                  Sign in with Google
                </Button>
              </VStack>
            </Center>
          ) : (
            <>
              {!selectedFile ? (
                <Center height="400px" borderWidth="1px" borderRadius="lg">
                  <VStack spacing={6}>
                    <Icon as={FiFile} boxSize={12} color="gray.400" />
                    <Text fontSize="lg">Select a spreadsheet from your Google Drive</Text>
                    <HStack spacing={4}>
                      <Button
                        colorScheme="brand"
                        size="lg"
                        onClick={openPicker}
                        leftIcon={<Icon as={FiFolder} />}
                      >
                        Browse Google Drive
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleSignOut}
                      >
                        Sign Out
                      </Button>
                    </HStack>
                  </VStack>
                </Center>
              ) : (
                <Box>
                  <HStack spacing={4} mb={4}>
                    <Button
                      colorScheme="brand"
                      onClick={openPicker}
                      leftIcon={<Icon as={FiFolder} />}
                    >
                      Change Spreadsheet
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSignOut}
                    >
                      Sign Out
                    </Button>
                  </HStack>
                  {renderFile()}
                </Box>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
};

// Add TypeScript interface for the Google API
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export default TradeTracker;