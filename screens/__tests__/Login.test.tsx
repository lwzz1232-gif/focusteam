import React from 'react';
import { render, screen } from '@testing-library/react';
import { Login } from '../Login';

describe('Login', () => {
  it('renders the login form', () => {
    render(<Login onLogin={() => {}} onBack={() => {}} />);
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });
});
