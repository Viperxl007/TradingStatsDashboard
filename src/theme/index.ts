import { extendTheme, ThemeConfig } from '@chakra-ui/react';

// Color mode config
const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

// Custom colors
const colors = {
  brand: {
    50: '#e6f7ff',
    100: '#b3e0ff',
    200: '#80caff',
    300: '#4db3ff',
    400: '#1a9dff',
    500: '#0080ff', // Primary brand color
    600: '#0066cc',
    700: '#004d99',
    800: '#003366',
    900: '#001a33',
  },
  profit: {
    50: '#e6fff0',
    100: '#ccffe0',
    200: '#99ffc2',
    300: '#66ffa3',
    400: '#33ff85',
    500: '#00ff66', // Profit green
    600: '#00cc52',
    700: '#00993d',
    800: '#006629',
    900: '#003314',
  },
  loss: {
    50: '#ffe6e6',
    100: '#ffcccc',
    200: '#ff9999',
    300: '#ff6666',
    400: '#ff3333',
    500: '#ff0000', // Loss red
    600: '#cc0000',
    700: '#990000',
    800: '#660000',
    900: '#330000',
  },
  neutral: {
    50: '#f2f2f2',
    100: '#d9d9d9',
    200: '#bfbfbf',
    300: '#a6a6a6',
    400: '#8c8c8c',
    500: '#737373',
    600: '#595959',
    700: '#404040',
    800: '#262626',
    900: '#0d0d0d',
  },
};

// Font configuration
const fonts = {
  heading: '"Inter", sans-serif',
  body: '"Inter", sans-serif',
};

// Component style overrides
const components = {
  Button: {
    baseStyle: {
      fontWeight: 'semibold',
      borderRadius: 'md',
    },
    variants: {
      solid: (props: any) => ({
        bg: props.colorMode === 'dark' ? 'brand.500' : 'brand.500',
        color: 'white',
        _hover: {
          bg: props.colorMode === 'dark' ? 'brand.600' : 'brand.400',
        },
      }),
      outline: (props: any) => ({
        borderColor: props.colorMode === 'dark' ? 'brand.500' : 'brand.500',
        color: props.colorMode === 'dark' ? 'brand.500' : 'brand.500',
        _hover: {
          bg: props.colorMode === 'dark' ? 'brand.100' : 'brand.50',
        },
      }),
    },
  },
  Card: {
    baseStyle: (props: any) => ({
      container: {
        bg: props.colorMode === 'dark' ? 'gray.700' : 'white',
        borderRadius: 'lg',
        boxShadow: 'md',
        overflow: 'hidden',
      },
      header: {
        py: 4,
        px: 6,
      },
      body: {
        py: 4,
        px: 6,
      },
      footer: {
        py: 4,
        px: 6,
      },
    }),
  },
  Heading: {
    baseStyle: {
      fontWeight: 'semibold',
    },
  },
};

// Global styles
const styles = {
  global: (props: any) => ({
    body: {
      bg: props.colorMode === 'dark' ? 'gray.800' : 'gray.50',
      color: props.colorMode === 'dark' ? 'white' : 'gray.800',
    },
  }),
};

// Breakpoints for responsive design
const breakpoints = {
  sm: '30em',
  md: '48em',
  lg: '62em',
  xl: '80em',
  '2xl': '96em',
};

// Create and export the theme
const theme = extendTheme({
  config,
  colors,
  fonts,
  components,
  styles,
  breakpoints,
});

export default theme;