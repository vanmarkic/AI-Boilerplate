import { render, screen } from '@testing-library/react';
import { Card } from './card';

describe('Card', () => {
  it('renders with default class', () => {
    render(<Card>Content</Card>);
    const card = screen.getByText('Content').closest('.card');
    expect(card).toHaveClass('card');
  });

  it('renders children in card-content', () => {
    render(<Card>Hello world</Card>);
    const content = screen.getByText('Hello world');
    expect(content).toHaveClass('card-content');
  });

  it('renders title when provided', () => {
    render(<Card title="My Title">Body</Card>);
    const title = screen.getByText('My Title');
    expect(title.tagName).toBe('H3');
    expect(title).toHaveClass('card-title');
  });

  it('does not render title when omitted', () => {
    const { container } = render(<Card>Body</Card>);
    expect(container.querySelector('.card-title')).toBeNull();
  });

  it('merges custom className', () => {
    const { container } = render(<Card className="custom">X</Card>);
    const card = container.firstElementChild;
    expect(card).toHaveClass('card');
    expect(card).toHaveClass('custom');
  });

  it('forwards extra HTML attributes', () => {
    const { container } = render(<Card data-testid="my-card">X</Card>);
    expect(container.querySelector('[data-testid="my-card"]')).toBeInTheDocument();
  });
});
