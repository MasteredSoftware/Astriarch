import { styled } from '../../stitches.config';

export const Button = styled('button', {
  // styles

  variants: {
    color: {
      turq: {
        border: '2px solid $turq',
        '&:hover': {
          backgroundColor: '$turq',
          color: '$black',
        },
      },
      orange: {
        border: '2px solid $orange',
        '&:hover': {
          backgroundColor: '$orange',
          color: '$black',
        },
      },
    },
  },
  defaultVariants: {
    color: 'turq',
  },
});