'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

// ── Schemas ────────────────────────────────────────────────────────────
const loginSchema = z.object({
    email: z.email('Masukkan alamat email yang valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
})

const signupSchema = z.object({
    name: z.string().min(1, 'Nama lengkap harus diisi'),
    email: z.email('Masukkan alamat email yang valid'),
    password: z.string().min(8, 'Password minimal 8 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi password harus diisi'),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Password dan konfirmasi password tidak cocok',
    path: ['confirmPassword'],
})

// ── Helpers ────────────────────────────────────────────────────────────
export type ActionResult = {
    success: boolean
    error?: string
}

// ── Login ──────────────────────────────────────────────────────────────
export async function login(values: {
    email: string
    password: string
}): Promise<ActionResult> {
    // Server-side validation
    const parsed = loginSchema.safeParse(values)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    try {
        const supabase = await createClient()

        const { error } = await supabase.auth.signInWithPassword({
            email: parsed.data.email,
            password: parsed.data.password,
        })

        if (error) {
            // Map common Supabase errors to user-friendly messages
            const message = mapAuthError(error.message)
            return { success: false, error: message }
        }
    } catch {
        return {
            success: false,
            error: 'Terjadi kesalahan pada server. Silakan coba lagi.',
        }
    }

    revalidatePath('/', 'layout')
    redirect('/dashboard')
}

// ── Signup ─────────────────────────────────────────────────────────────
export async function signup(values: {
    name: string
    email: string
    password: string
    confirmPassword: string
}): Promise<ActionResult> {
    // Server-side validation
    const parsed = signupSchema.safeParse(values)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    try {
        const supabase = await createClient()

        const { error } = await supabase.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: {
                data: {
                    full_name: parsed.data.name,
                },
            },
        })

        if (error) {
            const message = mapAuthError(error.message)
            return { success: false, error: message }
        }

        return { success: true }
    } catch {
        return {
            success: false,
            error: 'Terjadi kesalahan pada server. Silakan coba lagi.',
        }
    }
}

// ── Error mapping ──────────────────────────────────────────────────────
function mapAuthError(message: string): string {
    const lower = message.toLowerCase()

    if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
        return 'Email atau password salah. Silakan coba lagi.'
    }
    if (lower.includes('email not confirmed')) {
        return 'Email belum diverifikasi. Silakan cek inbox Anda.'
    }
    if (lower.includes('user already registered') || lower.includes('already been registered')) {
        return 'Email sudah terdaftar. Silakan gunakan email lain atau masuk.'
    }
    if (lower.includes('signup is disabled')) {
        return 'Pendaftaran sedang tidak tersedia.'
    }
    if (lower.includes('rate limit') || lower.includes('too many requests')) {
        return 'Terlalu banyak percobaan. Silakan tunggu beberapa saat.'
    }
    if (lower.includes('weak password') || lower.includes('password')) {
        return 'Password terlalu lemah. Gunakan kombinasi huruf, angka, dan simbol.'
    }

    return message
}