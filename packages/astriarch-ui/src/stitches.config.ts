import { createStitches } from '@stitches/react';

export const { styled, createTheme } = createStitches({
    theme: {
      colors: {
        black: 'rgba(19, 19, 21, 1)',
        white: 'rgba(255, 255, 255, 1)',
        gray: 'rgba(128, 128, 128, 1)',
        blue: 'rgba(3, 136, 252, 1)',
        red: 'rgba(249, 16, 74, 1)',
        yellow: 'rgba(255, 221, 0, 1)',
        pink: 'rgba(232, 141, 163, 1)',
        turq: 'rgba(0, 245, 196, 1)',
        orange: 'rgba(255, 135, 31, 1)',
      },
      fonts: {
        sans: 'Inter, sans-serif',
      },
      fontSizes: {
        1: '12px',
        2: '14px',
        3: '16px',
        4: '20px',
        5: '24px',
        6: '32px',
      },
      space: {
        1: '4px',
        2: '8px',
        3: '16px',
        4: '32px',
        5: '64px',
        6: '128px',
      },
      sizes: {
        1: '4px',
        2: '8px',
        3: '16px',
        4: '32px',
        5: '64px',
        6: '128px',
      },
      radii: {
        1: '2px',
        2: '4px',
        3: '8px',
        round: '9999px',
      },
      fontWeights: {},
      lineHeights: {},
      letterSpacings: {},
      borderWidths: {},
      borderStyles: {},
      shadows: {},
      zIndices: {},
      transitions: {},
    },
    media: {
      bp1: '(min-width: 575px)',
      bp2: '(min-width: 750px)',
    }
  });

  export const darkTheme = createTheme('dark-theme',{
    colors: {
      hiContrast: 'hsl(206,2%,93%)',
      loContrast: 'hsl(206,8%,8%)',
  
      gray100: 'hsl(206,8%,12%)',
      gray200: 'hsl(206,7%,14%)',
      gray300: 'hsl(206,7%,15%)',
      gray400: 'hsl(206,7%,24%)',
      gray500: 'hsl(206,7%,30%)',
      gray600: 'hsl(206,5%,53%)',
    },
    space: {},
    fonts: {},
  });
