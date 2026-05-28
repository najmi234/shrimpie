'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { signup } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

import { createClient } from '@/lib/supabase/client'

// ── Component ──────────────────────────────────────────────────────────
export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const t = useTranslations('signup')

  // ── Schema (inside component for i18n) ─────────────────────────────
  const signupSchema = z
    .object({
      name: z.string().min(1, t('validationName')),
      email: z.email(t('validationEmail')),
      password: z.string().min(8, t('validationPassword')),
      confirmPassword: z.string().min(1, t('validationConfirmPassword')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('validationPasswordMatch'),
      path: ['confirmPassword'],
    })

  type SignupValues = z.infer<typeof signupSchema>

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  async function onSubmit(values: SignupValues) {
    setServerError(null)

    const result = await signup(values)

    if (result.success) {
      setRegistered(true)
    } else if (result.error) {
      setServerError(result.error)
    }
  }

  async function handleGoogleSignUp() {
    try {
      setGoogleLoading(true)
      setServerError(null)
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setServerError(error.message)
      }
    } catch (err: any) {
      setServerError(t('googleError'))
    } finally {
      setGoogleLoading(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────────
  if (registered) {
    return (
      <Card {...props}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="size-6" />
          </div>
          <CardTitle>{t('successTitle')}</CardTitle>
          <CardDescription>
            {t('successDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle2 className="size-4" />
            <AlertTitle>{t('successAlert')}</AlertTitle>
            <AlertDescription>
              {t('successHint')}
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            {t('verifiedQuestion')}{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              {t('login')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    )
  }

  // ── Registration form ──────────────────────────────────────────────
  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>
          {t('description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldGroup>
            {/* ── Server error alert ──────────────────────────── */}
            {serverError && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}

            {/* ── Name ──────────────────────────────────────────── */}
            <Field data-invalid={!!errors.name || undefined}>
              <FieldLabel htmlFor="name">{t('nameLabel')}</FieldLabel>
              <Input
                id="name"
                type="text"
                placeholder={t('namePlaceholder')}
                autoComplete="name"
                disabled={isSubmitting}
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </Field>

            {/* ── Email ────────────────────────────────────────── */}
            <Field data-invalid={!!errors.email || undefined}>
              <FieldLabel htmlFor="email">{t('emailLabel')}</FieldLabel>
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                autoComplete="email"
                disabled={isSubmitting}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              <FieldError>{errors.email?.message}</FieldError>
            </Field>

            {/* ── Password ─────────────────────────────────────── */}
            <Field data-invalid={!!errors.password || undefined}>
              <FieldLabel htmlFor="password">{t('passwordLabel')}</FieldLabel>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.password}
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={
                    showPassword
                      ? t('hidePassword')
                      : t('showPassword')
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <FieldDescription>{t('passwordMinChars')}</FieldDescription>
              <FieldError>{errors.password?.message}</FieldError>
            </Field>

            {/* ── Confirm Password ─────────────────────────────── */}
            <Field data-invalid={!!errors.confirmPassword || undefined}>
              <FieldLabel htmlFor="confirmPassword">
                {t('confirmPasswordLabel')}
              </FieldLabel>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.confirmPassword}
                  className="pr-10"
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={
                    showConfirm
                      ? t('hidePassword')
                      : t('showPassword')
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
              <FieldDescription>{t('confirmPasswordHint')}</FieldDescription>
              <FieldError>{errors.confirmPassword?.message}</FieldError>
            </Field>

            {/* ── Submit ───────────────────────────────────────── */}
            <FieldGroup>
              <Field>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('submit')}…
                    </>
                  ) : (
                    t('submit')
                  )}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={isSubmitting || googleLoading}
                  className="w-full gap-2"
                >
                  {googleLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <svg className="size-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                      <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                    </svg>
                  )}
                  {t('googleSignUp')}
                </Button>
                <FieldDescription className="px-6 text-center">
                  {t('hasAccount')}{' '}
                  <Link href="/login">{t('login')}</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
