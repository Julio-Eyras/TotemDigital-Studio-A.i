/**
 * useForm Hook - SmartSignage Pro v2.1
 * Hook para gerenciar formulários com validação
 */

import { useState, useCallback, useMemo } from 'react';

export interface ValidationRule<T = any> {
  validator: (value: any, formData: T) => boolean | string;
  message?: string;
}

export interface FieldConfig<T = any> {
  name: keyof T;
  rules?: ValidationRule<T>[];
  required?: boolean;
}

export interface UseFormOptions<T> {
  initialValues: T;
  fields?: FieldConfig<T>[];
  onSubmit?: (data: T) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export interface UseFormReturn<T> {
  values: T;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isValid: boolean;
  setValue: (name: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  setError: (name: keyof T, error: string) => void;
  setErrors: (errors: Record<string, string>) => void;
  validate: () => boolean;
  validateField: (name: keyof T) => boolean;
  reset: () => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  getFieldProps: (name: keyof T) => {
    value: any;
    onChange: (e: React.ChangeEvent<any>) => void;
    onBlur: () => void;
    error: boolean;
    helperText: string | undefined;
  };
}

export function useForm<T extends Record<string, any>>(
  options: UseFormOptions<T>
): UseFormReturn<T> {
  const {
    initialValues,
    fields = [],
    onSubmit,
    validateOnChange = true,
    validateOnBlur = true,
  } = options;

  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrorsState] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback(
    (name: keyof T): boolean => {
      const field = fields.find((f) => f.name === name);
      if (!field) return true;

      const value = values[name];
      let error = '';

      // Required validation
      if (field.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
        error = `${String(name)} é obrigatório`;
      }

      // Custom rules
      if (!error && field.rules) {
        for (const rule of field.rules) {
          const result = rule.validator(value, values);
          if (result !== true) {
            error = typeof result === 'string' ? result : rule.message || 'Validação falhou';
            break;
          }
        }
      }

      setErrorsState((prev) => ({
        ...prev,
        [name]: error,
      }));

      return !error;
    },
    [values, fields]
  );

  const validate = useCallback((): boolean => {
    let isValid = true;
    const newErrors: Record<string, string> = {};

    fields.forEach((field) => {
      const fieldValid = validateField(field.name);
      if (!fieldValid) {
        isValid = false;
      }
    });

    return isValid;
  }, [fields, validateField]);

  const setValue = useCallback(
    (name: keyof T, value: any) => {
      setValuesState((prev) => ({
        ...prev,
        [name]: value,
      }));

      if (validateOnChange) {
        validateField(name);
      }
    },
    [validateOnChange, validateField]
  );

  const setValues = useCallback((newValues: Partial<T>) => {
    setValuesState((prev) => ({
      ...prev,
      ...newValues,
    }));
  }, []);

  const setError = useCallback((name: keyof T, error: string) => {
    setErrorsState((prev) => ({
      ...prev,
      [name]: error,
    }));
  }, []);

  const setErrors = useCallback((newErrors: Record<string, string>) => {
    setErrorsState(newErrors);
  }, []);

  const reset = useCallback(() => {
    setValuesState(initialValues);
    setErrorsState({});
    setTouched({});
  }, [initialValues]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      if (validate()) {
        await onSubmit?.(values);
      }
    },
    [validate, onSubmit, values]
  );

  const getFieldProps = useCallback(
    (name: keyof T) => {
      const nameStr = String(name);
      return {
        value: values[name] || '',
        onChange: (e: React.ChangeEvent<any>) => {
          const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
          setValue(name, value);
        },
        onBlur: () => {
          setTouched((prev) => ({ ...prev, [nameStr]: true }));
          if (validateOnBlur) {
            validateField(name);
          }
        },
        error: Boolean(touched[nameStr] && errors[nameStr]),
        helperText: touched[nameStr] ? errors[nameStr] : undefined,
      };
    },
    [values, errors, touched, setValue, validateOnBlur, validateField]
  );

  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0 && Object.keys(touched).length > 0;
  }, [errors, touched]);

  return {
    values,
    errors,
    touched,
    isValid,
    setValue,
    setValues,
    setError,
    setErrors,
    validate,
    validateField,
    reset,
    handleSubmit,
    getFieldProps,
  };
}
