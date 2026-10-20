'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { BuildingIcon, EyeIcon, EyeOffIcon, LogInIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { login } from '@/features/auth/actions';
import { LOGIN_MESSAGES } from '@/features/auth/messages';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { endSignOut } from '@/lib/api/client';
import { getQueryClient } from '@/lib/query-client';
import { loginRequestSchema, type LoginRequest } from '@/lib/contract/auth';

interface LoginFormProps {
  /** Page to open after signing in; the action checks it again. */
  from?: string | undefined;
  /** The visitor was sent here because the API rejected their session. */
  expired?: boolean;
}

export function LoginForm({ from, expired = false }: LoginFormProps) {
  const errorId = useId();
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // `handleSubmit` validates asynchronously, so `pending` is not set yet when a fast second
  // submit arrives; a ref is.
  const submitting = useRef(false);

  // Signing out is a client-side navigation, so the browser keeps this module's state: the 401
  // handler must listen again once the login page is on screen. A request that was in flight
  // during sign-out may have refilled the cache since; nobody who signs in next may see that.
  useEffect(() => {
    endSignOut();
    getQueryClient().clear();
  }, []);

  // Errors appear once a field is left, not on every keystroke; there is no "valid" gate on the
  // button, so the form never sits disabled without saying why.
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  });

  // A server message describes the last attempt; the first edit starts a new one.
  const clearServerError = () => {
    setServerError(null);
  };

  const signIn = (values: LoginRequest) => {
    if (submitting.current) return;
    submitting.current = true;
    setServerError(null);
    startTransition(async () => {
      let message: string;
      try {
        message = (await login(values, from)).message;
      } catch (cause) {
        // A successful login redirects by throwing; Next has to see that.
        unstable_rethrow(cause);
        message = LOGIN_MESSAGES.failed;
      } finally {
        submitting.current = false;
      }
      // State set after an `await` needs its own transition.
      startTransition(() => {
        setServerError(message);
        // The submit button was disabled, so focus fell to the page; the password is what to retry.
        setFocus('password');
      });
    });
  };

  const emailError = errors.email?.message;
  const passwordError = errors.password?.message;
  // The message of the server concerns both fields, so both point at it.
  const describedBy = (fieldErrorId: string | undefined) =>
    [fieldErrorId, serverError ? errorId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="justify-items-center text-center">
        <span className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <BuildingIcon className="size-5" aria-hidden />
        </span>
        <h1 id={titleId} className="text-xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="text-sm text-muted-foreground">to Coworking Admin</p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            void handleSubmit(signIn)(event);
          }}
          noValidate
          aria-labelledby={titleId}
          // Read-only, not disabled, while a request runs: a disabled field loses focus and its
          // value would drop out of the form.
          aria-busy={pending}
          className="flex flex-col gap-4"
        >
          {expired && !serverError && (
            <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
              {LOGIN_MESSAGES.expired}
            </p>
          )}
          {serverError && (
            <p
              id={errorId}
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {serverError}
            </p>
          )}
          <Field data-invalid={!!emailError}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              readOnly={pending}
              aria-invalid={!!emailError || !!serverError}
              aria-describedby={describedBy(emailError ? 'email-error' : undefined)}
              {...register('email', { onChange: clearServerError })}
            />
            {emailError && <FieldError id="email-error">{emailError}</FieldError>}
          </Field>
          <Field data-invalid={!!passwordError}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                readOnly={pending}
                className="pr-9"
                aria-invalid={!!passwordError || !!serverError}
                aria-describedby={describedBy(passwordError ? 'password-error' : undefined)}
                {...register('password', { onChange: clearServerError })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-0.5 right-0.5"
                aria-label="Show password"
                aria-pressed={showPassword}
                onClick={() => {
                  setShowPassword((shown) => !shown);
                }}
              >
                {showPassword ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
              </Button>
            </div>
            {passwordError && <FieldError id="password-error">{passwordError}</FieldError>}
          </Field>
          <Button type="submit" disabled={pending}>
            <LogInIcon aria-hidden />
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Demo account: admin@coworking.test / demo1234
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
