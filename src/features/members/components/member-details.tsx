'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { PencilIcon, TrashIcon } from 'lucide-react';
import { DetailsList } from '@/components/details-list';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { MemberStatusBadge } from '@/components/status-badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/config/routes';
import { ApiError } from '@/lib/api/errors';
import { memberFullName } from '@/lib/contract/member';
import { formatDate } from '@/lib/format-date';
import { humanize } from '@/lib/humanize';
import { cn } from '@/lib/utils';
import { memberQuery } from '@/features/members/api/member-queries';
import { DeleteMemberDialog } from '@/features/members/components/delete-member-dialog';
import { MemberFormDialog } from '@/features/members/components/member-form-dialog';

/** One member: their fields, edit and delete. Failures are explained on the page, not in a toast. */
export function MemberDetails({ id }: { id: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // After a delete the record is gone; until the list opens the page must not ask for it again.
  const [deleted, setDeleted] = useState(false);
  const query = useQuery(memberQuery(id, { enabled: !deleted }));

  if (query.isPending || deleted) {
    return (
      <div role="status" aria-label="Loading member" className="flex flex-col gap-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // A failed refetch in the background keeps the data on screen; only a missing record is an error.
  if (query.data === undefined) {
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return notFound ? (
      <EmptyState title="Member not found">
        <p>They may have been removed.</p>
        <Link href={ROUTES.members} className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
          All members
        </Link>
      </EmptyState>
    ) : (
      <EmptyState title="Could not load the member">
        <p>{query.error.message}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            void query.refetch();
          }}
        >
          Try again
        </Button>
      </EmptyState>
    );
  }

  const member = query.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={memberFullName(member)}
        subtitle={member.company ?? undefined}
        back={{ href: ROUTES.members, label: 'Members' }}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(true);
              }}
            >
              <PencilIcon aria-hidden />
              Edit
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleting(true);
              }}
            >
              <TrashIcon aria-hidden />
              Delete
            </Button>
          </>
        }
      />

      <Card>
        <CardContent>
          <DetailsList
            items={[
              { label: 'Status', value: <MemberStatusBadge status={member.status} /> },
              { label: 'Plan', value: humanize(member.plan) },
              {
                label: 'Email',
                value: (
                  <a
                    href={`mailto:${member.email}`}
                    className="hover:underline focus-visible:underline"
                  >
                    {member.email}
                  </a>
                ),
              },
              { label: 'Phone', value: member.phone },
              { label: 'Company', value: member.company },
              { label: 'Member since', value: formatDate(member.joinedAt) },
            ]}
          />
        </CardContent>
      </Card>

      <MemberFormDialog open={editing} onOpenChange={setEditing} member={member} />
      <DeleteMemberDialog
        member={member}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => {
          setDeleted(true);
          router.replace(ROUTES.members);
        }}
      />
    </div>
  );
}
