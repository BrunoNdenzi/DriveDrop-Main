import { useState, useCallback } from 'react';

interface Validator<T> {
  (value: T): string | null;
}

interface Validators<T> {
  [key: string]: Validator<T[keyof T]>;
}

interface FormErrors<T> {
  [key: string]: string | null;
}

interface UseFormValidationReturn<T> {
  errors: FormErrors<T>;
  validateField: (name: keyof T, value: T[keyof T]) => string | null;
  validateForm: (data: T) => boolean;
  setFieldError: (name: keyof T, error: string | null) => void;
  clearErrors: () => void;
}

/**
 * Hook for handling form validation
 */
export function useFormValidation<T extends Record<string, any>>(
  validators: Validators<T>
): UseFormValidationReturn<T> {
  const [errors, setErrors] = useState<FormErrors<T>>({});

  const validateField = useCallback(
    (name: keyof T, value: T[keyof T]): string | null => {
      const validator = validators[name as string];
      if (!validator) return null;

      const error = validator(value);
      setErrors((prev) => ({ ...prev, [name]: error }));
      return error;
    },
    [validators]
  );

  const validateForm = useCallback(
    (data: T): boolean => {
      const newErrors: FormErrors<T> = {};
      let isValid = true;

      Object.keys(validators).forEach((key) => {
        const validator = validators[key];
        const value = data[key as keyof T];
        const error = validator(value);

        if (error) {
          isValid = false;
          newErrors[key] = error;
        } else {
          newErrors[key] = null;
        }
      });

      setErrors(newErrors);
      return isValid;
    },
    [validators]
  );

  const setFieldError = useCallback(
    (name: keyof T, error: string | null) => {
      setErrors((prev) => ({ ...prev, [name]: error }));
    },
    []
  );

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validateField,
    validateForm,
    setFieldError,
    clearErrors,
  };
}

// Common validators
export const required = (value: any): string | null => {
  if (value === undefined || value === null || value === '') {
    return 'This field is required';
  }
  return null;
};

export const email = (value: string): string | null => {
  if (!value) return null;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return 'Please enter a valid email address';
  }
  return null;
};

export const minLength = (min: number) => (value: string): string | null => {
  if (!value) return null;
  
  if (value.length < min) {
    return `Must be at least ${min} characters`;
  }
  return null;
};

export const maxLength = (max: number) => (value: string): string | null => {
  if (!value) return null;
  
  if (value.length > max) {
    return `Must be at most ${max} characters`;
  }
  return null;
};

export const phoneNumber = (value: string): string | null => {
  if (!value) return null;
  
  const phoneRegex = /^\+?[0-9]{10,15}$/;
  if (!phoneRegex.test(value.replace(/[\s()-]/g, ''))) {
    return 'Please enter a valid phone number';
  }
  return null;
};

export const composeValidators = (...validators: Array<(value: any) => string | null>) => (
  value: any
): string | null => {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
};
