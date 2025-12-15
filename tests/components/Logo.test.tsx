import { render, screen } from '@testing-library/react';
import { Logo } from '../../components/Logo';

describe('Logo', () => {
  it('renders the logo', () => {
    render(<Logo />);
    const logoElement = screen.getByTestId('logo-svg');
    expect(logoElement).toBeInTheDocument();
  });
});
