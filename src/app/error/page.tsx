'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ErrorContent() {
    const searchParams = useSearchParams()
    const message = searchParams.get('message')

    return (
        <div style={{ padding: '2rem' }}>
            <h1>Something went wrong</h1>
            {message && (
                <p style={{ color: 'red', marginTop: '1rem' }}>
                    <strong>Error:</strong> {message}
                </p>
            )}
            <a href="/login" style={{ marginTop: '1rem', display: 'inline-block' }}>
                ← Back to Login
            </a>
        </div>
    )
}

export default function ErrorPage() {
    return (
        <Suspense fallback={<p>Loading...</p>}>
            <ErrorContent />
        </Suspense>
    )
}