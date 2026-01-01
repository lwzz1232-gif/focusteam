
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders the button with the correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls the onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables the button when isLoading is true', () => {
    render(<Button isLoading>Click me</Button>);
    // When loading, the text is replaced by a spinner, so we find by role
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
