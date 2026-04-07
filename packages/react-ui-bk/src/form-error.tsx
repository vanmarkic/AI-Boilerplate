const ERROR_MESSAGES: Record<string, string> = {
  required: 'This field is required',
  email: 'Please enter a valid email address',
  maxlength: 'Value is too long',
  minlength: 'Value is too short',
};

export interface FormErrorProps {
  errors?: Record<string, unknown>;
  touched?: boolean;
}

export function FormError({ errors, touched }: FormErrorProps) {
  if (!touched || !errors) return null;
  const keys = Object.keys(errors);
  if (keys.length === 0) return null;

  return (
    <div role="alert">
      {keys.map((key) => (
        <p key={key} className="form-error">
          {ERROR_MESSAGES[key] ?? key}
        </p>
      ))}
    </div>
  );
}
