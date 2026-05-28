'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type User } from '@supabase/supabase-js'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { motion } from 'framer-motion'
import {
    User as UserIcon,
    Mail,
    AtSign,
    Calendar,
    Shield,
    Save,
    Loader2,
    Check,
    LogOut,
    Users,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Profile {
    username: string | null
    avatar_url: string | null
    birth_date: string | null
    gender: string | null
    user_role: string | null
}

export default function AccountForm({ user }: { user: User | null }) {
    const supabase = createClient()
    const t = useTranslations('account')
    const tCommon = useTranslations('common')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [profile, setProfile] = useState<Profile>({
        username: null,
        avatar_url: null,
        birth_date: null,
        gender: null,
        user_role: null,
    })

    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || ''

    const getProfile = useCallback(async () => {
        try {
            setLoading(true)
            const { data, error, status } = await supabase
                .from('profiles')
                .select('username, avatar_url, birth_date, gender, user_role')
                .eq('id', user?.id)
                .single()

            if (error && status !== 406) {
                console.error('Error loading profile:', error)
            }

            if (data) {
                setProfile(data)
            }
        } catch (error) {
            console.error('Error loading profile:', error)
        } finally {
            setLoading(false)
        }
    }, [user, supabase])

    useEffect(() => {
        if (user) getProfile()
    }, [user, getProfile])

    const handleFieldChange = (field: keyof Profile, value: string) => {
        setProfile((prev) => ({ ...prev, [field]: value }))
        setSaved(false)
    }

    async function handleSave() {
        try {
            setSaving(true)
            const { error } = await supabase.from('profiles').upsert({
                id: user?.id as string,
                username: profile.username,
                avatar_url: profile.avatar_url,
                birth_date: profile.birth_date,
                gender: profile.gender,
            })
            if (error) throw error
            setSaved(true)
            setTimeout(() => setSaved(false), 2500)
        } catch (error) {
            console.error('Error updating profile:', error)
        } finally {
            setSaving(false)
        }
    }

    const tAdmin = useTranslations('admin')

    const userInitial = (profile.username || fullName || user?.email || 'U').charAt(0).toUpperCase()

    const genderOptions = [
        { value: 'male', label: t('male') },
        { value: 'female', label: t('female') },
    ]

    const roleLabel = profile.user_role === 'admin' ? tAdmin('administrator') : profile.user_role === 'guest' ? tAdmin('guest') : profile.user_role || '-'
    const roleColor = profile.user_role === 'admin' ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-blue-500/10 text-blue-600 border-blue-500/30'

    if (loading) {
        return (
            <div className="container mx-auto max-w-2xl flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="container mx-auto max-w-2xl space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{t("description")}</p>
            </div>

            {/* Profile Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="rounded-2xl py-0 border-border shadow-sm overflow-hidden">
                    {/* Banner */}
                    <div className="h-24 bg-gradient-to-r from-primary/80 via-indigo-500/70 to-purple-500/60 relative">
                        <div className="absolute -bottom-10 left-6">
                            <div className="w-20 h-20 rounded-2xl bg-background border-4 border-background shadow-lg flex items-center justify-center text-2xl font-bold text-primary">
                                {userInitial}
                            </div>
                        </div>
                    </div>
                    <CardContent className="pt-14 pb-6 px-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">{fullName || profile.username || 'User'}</h2>
                                <p className="text-sm text-muted-foreground">{user?.email}</p>
                            </div>
                            <span className={`text-xs font-medium px-3 py-1 rounded-full border w-fit ${roleColor}`}>
                                <Shield className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                                {roleLabel}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Edit Form */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="rounded-2xl py-0 border-border shadow-sm">
                    <CardContent className="p-6 space-y-5">
                        <h3 className="text-base font-semibold text-foreground">{t("accountInfo")}</h3>

                        {/* Email (read-only) */}
                        <div>
                            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5" /> {t("email")}
                            </label>
                            <Input
                                value={user?.email || ''}
                                disabled
                                className="h-10 text-sm bg-muted/50 border-border"
                            />
                        </div>

                        {/* Username */}
                        <div>
                            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <AtSign className="w-3.5 h-3.5" /> {t("username")}
                            </label>
                            <Input
                                value={profile.username || ''}
                                onChange={(e) => handleFieldChange('username', e.target.value)}
                                placeholder="username"
                                className="h-10 text-sm border-border"
                            />
                        </div>

                        {/* Birth Date */}
                        <div>
                            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" /> {t("birthDate")}
                            </label>
                            <Input
                                type="date"
                                value={profile.birth_date || ''}
                                onChange={(e) => handleFieldChange('birth_date', e.target.value)}
                                className="h-10 text-sm border-border"
                            />
                        </div>

                        {/* Gender */}
                        <div>
                            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5" /> {t("gender")}
                            </label>
                            <div className="flex gap-3">
                                {genderOptions.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => handleFieldChange('gender', opt.value)}
                                        className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-all ${profile.gender === opt.value
                                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                            : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Role (read-only) */}
                        <div>
                            <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5" /> {t("role")}
                            </label>
                            <Input
                                value={roleLabel}
                                disabled
                                className="h-10 text-sm bg-muted/50 border-border"
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="gap-2 flex-1 sm:flex-none"
                                variant={saved ? 'outline' : 'default'}
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : saved ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving ? tCommon('saving') : saved ? tCommon('saved') : t('saveChanges')}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Sign Out Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="rounded-2xl py-0 border-border shadow-sm border-destructive/20">
                    <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">{t("signOutTitle")}</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">{t("signOutDescription")}</p>
                            </div>
                            <form action="/auth/signout" method="post">
                                <Button type="submit" variant="destructive" size="sm" className="gap-2">
                                    <LogOut className="w-4 h-4" />
                                    {t("signOut")}
                                </Button>
                            </form>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    )
}