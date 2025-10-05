import { render, screen } from '@testing-library/react';
import App from './App';

test('renders show calendar button', () => {
  render(<App />);
  const buttonElement = screen.getByText(/show calendar/i);
  expect(buttonElement).toBeInTheDocument();
});