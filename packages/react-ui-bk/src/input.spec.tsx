import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './input';

describe('Input', () => {
  it('renders with label linked to input', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toHaveClass('input-base');
  });

  it('renders without label', () => {
    render(<Input placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toHaveClass('input-base');
  });

  it('fires onChange and onValueChange', async () => {
    const onValueChange = vi.fn();
    const onChange = vi.fn();
    render(<Input label="Name" onChange={onChange} onValueChange={onValueChange} />);
    await userEvent.type(screen.getByLabelText('Name'), 'hi');
    expect(onChange).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenLastCalledWith('hi');
  });

  it('renders as disabled', () => {
    render(<Input label="Locked" disabled />);
    expect(screen.getByLabelText('Locked')).toBeDisabled();
  });
});
