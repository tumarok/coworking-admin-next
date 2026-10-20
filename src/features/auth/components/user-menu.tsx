'use client';

import { useTransition } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { LogOutIcon } from 'lucide-react';
import { toast } from 'sonner';
import { logout } from '@/features/auth/actions';
import { Button } from '@/components/ui/button';
import { beginSignOut, endSignOut } from '@/lib/api/client';
import type { User } from '@/lib/contract/auth';

/** Who is signed in, and the way out. */
export function UserMenu({ user }: { user: User }) {
  const [pending, startTransition] = useTransition();

  const signOut = () => {
    startTransition(async () => {
      // Order matters: requests still in flight fail with 401 once the cookie is gone, and must
      // not start a second sign-out; the cache goes before the next user can see it.
      beginSignOut();
      try {
        await logout();
      } catch (cause) {
        // The redirect to the login page arrives as a thrown value; Next has to see it.
        unstable_rethrow(cause);
        endSignOut();
        toast.error('Could not sign out. Try again.');
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <p className="hidden text-right text-sm leading-tight sm:block">
        <span className="block font-medium">{user.name}</span>
        <span className="block text-xs text-muted-foreground capitalize">{user.role}</span>
      </p>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={signOut}>
        <LogOutIcon aria-hidden />
        Sign out
      </Button>
    </div>
  );
}
