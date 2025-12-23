import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Logo } from '../../components/Logo';

describe('Logo', () => {
  it('renders the logo SVG', () => {
    render(<Logo />);
    expect(screen.getByTestId('focustwin-logo')).toBeInTheDocument();
  });
});
