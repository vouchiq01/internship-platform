'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

interface OrderResponse {
  enrollmentId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

function loadCheckout(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('load failed')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment window'));
    document.body.appendChild(script);
  });
}

export function EnrolButton({
  trackId,
  trackTitle,
  priceInr,
}: {
  trackId: string;
  trackTitle: string;
  priceInr: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrol = useCallback(async () => {
    setPending(true);
    setError(null);

    try {
      const supabase = createBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push(`/sign-in?next=/tracks`);
        return;
      }

      // The body carries a track id and nothing else. The server reads the
      // price from its own records — sending an amount here would do nothing.
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/enrollments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ trackId }),
      });

      const body = await res.json();

      if (res.status === 409) {
        router.push('/dashboard');
        return;
      }
      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'Could not start the payment');
      }

      const order = body as OrderResponse;
      await loadCheckout();

      const checkout = new window.Razorpay!({
        key: order.keyId,
        amount: order.amountPaise,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Internship Platform',
        description: `${trackTitle} track`,
        prefill: { email: session.user.email },
        theme: { color: '#6e7bff' },
        // Access is granted by the webhook, not here. This handler only moves
        // the student to a screen that reflects that.
        handler: () => router.push('/dashboard?payment=processing'),
        modal: { ondismiss: () => setPending(false) },
      });

      checkout.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPending(false);
    }
  }, [trackId, trackTitle, router]);

  return (
    <div>
      <button
        onClick={enrol}
        disabled={pending}
        className="group relative w-full overflow-hidden bg-bone-100 px-8 py-4 text-sm font-medium text-ink-900 disabled:opacity-60 sm:w-auto"
      >
        <span className="relative z-10">
          {pending ? 'Opening payment…' : `Enrol for ₹${priceInr.toLocaleString('en-IN')}`}
        </span>
        <span className="absolute inset-0 origin-left scale-x-0 bg-track-dev transition-transform duration-500 ease-[cubic-bezier(0.16,0.84,0.28,1)] group-hover:scale-x-100 group-disabled:scale-x-0" />
      </button>

      {error && (
        <p
          role="alert"
          className="mt-4 border-l-2 border-track-ops bg-track-ops/10 px-4 py-3 font-mono text-[11px] leading-relaxed text-bone-200"
        >
          {error}
        </p>
      )}
    </div>
  );
}
