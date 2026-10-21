import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from './form-field';

describe('FormField', () => {
  it('connects the label to the control', () => {
    render(<FormField label="City">{(control) => <input {...control} />}</FormField>);

    expect(screen.getByLabelText('City')).toBeInTheDocument();
  });

  it('marks a required field without adding the asterisk to its name', () => {
    render(
      <FormField label="City" required>
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.getByRole('textbox', { name: 'City' })).toBeRequired();
  });

  it('ties an error to the control and marks it invalid', () => {
    render(
      <FormField label="City" error="At least 2 characters">
        {(control) => <input {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText('City');
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('At least 2 characters');
    expect(screen.getByRole('alert')).toHaveTextContent('At least 2 characters');
  });

  it('describes the control with the hint and the error together', () => {
    render(
      <FormField label="City" hint="Where it is" error="Required">
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(screen.getByLabelText('City')).toHaveAccessibleDescription('Required Where it is');
  });

  it('leaves a clean field valid and undescribed', () => {
    render(<FormField label="City">{(control) => <input {...control} />}</FormField>);

    const input = screen.getByLabelText('City');
    expect(input).toBeValid();
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
