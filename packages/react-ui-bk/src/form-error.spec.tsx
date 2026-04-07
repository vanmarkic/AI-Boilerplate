import { render, screen } from '@testing-library/react';
import { FormError } from './form-error';

describe('FormError', () => {
  it('renders nothing when not touched', () => {
    const { container } = render(
      <FormError errors={{ required: true }} touched={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no errors', () => {
    const { container } = render(<FormError errors={{}} touched />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows mapped message for "required"', () => {
    render(<FormError errors={{ required: true }} touched />);
    expect(screen.getByText('This field is required')).toHaveClass(
      'form-error',
    );
  });

  it('shows mapped message for "email"', () => {
    render(<FormError errors={{ email: true }} touched />);
    expect(screen.getByText('Please enter a valid email address')).toHaveClass(
      'form-error',
    );
  });

  it('falls back to key name for unknown errors', () => {
    render(<FormError errors={{ customRule: true }} touched />);
    expect(screen.getByText('customRule')).toHaveClass('form-error');
  });
});
