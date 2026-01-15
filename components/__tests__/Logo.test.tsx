import React from 'react';
import { render, screen } from '@testing-library/react';
import { Logo } from '../Logo';

describe('Logo', () => {
  it('renders the logo SVG', () => {
    render(<Logo />);
    const svgElement = screen.getByTitle('FocusTwin Logo');
    expect(svgElement).toBeInTheDocument();
  });
});
