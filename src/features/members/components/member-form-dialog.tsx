'use client';

import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormDialog, FormDialogFooter, FormError } from '@/components/form-dialog';
import { FormField } from '@/components/form-field';
import { FormSelect } from '@/components/form-select';
import { Input } from '@/components/ui/input';
import { applyServerErrors } from '@/lib/form';
import { memberFullName, type Member } from '@/lib/contract/member';
import { useCreateMember, useUpdateMember } from '@/features/members/api/member-mutations';
import { PLAN_OPTIONS, STATUS_OPTIONS } from '@/features/members/constants';
import {
  MEMBER_FORM_FIELDS,
  memberFormSchema,
  toFormValues,
  toMemberInput,
  type MemberFormValues,
} from '@/features/members/schemas';

interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The member to edit; without it the dialog creates one. */
  member?: Member | undefined;
  onSaved?: (member: Member) => void;
}

/** Create or edit a member. Stays open when the save fails and says why. */
export function MemberFormDialog({ open, onOpenChange, member, onSaved }: MemberFormDialogProps) {
  const create = useCreateMember();
  const update = useUpdateMember(member?.id ?? '');
  const mutation = member ? update : create;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={member ? `Edit ${memberFullName(member)}` : 'New member'}
      pending={mutation.isPending}
    >
      <MemberForm
        member={member}
        pending={mutation.isPending}
        save={mutation.mutateAsync}
        onCancel={() => {
          onOpenChange(false);
        }}
        onSaved={(saved) => {
          toast.success(member ? 'Member updated' : 'Member added', {
            description: memberFullName(saved),
          });
          onOpenChange(false);
          onSaved?.(saved);
        }}
      />
    </FormDialog>
  );
}

interface MemberFormProps {
  member: Member | undefined;
  pending: boolean;
  save: (input: ReturnType<typeof toMemberInput>) => Promise<Member>;
  onCancel: () => void;
  onSaved: (member: Member) => void;
}

// Mounted only while the dialog is open, so every opening starts from the member's values.
function MemberForm({ member, pending, save, onCancel, onSaved }: MemberFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    mode: 'onTouched',
    defaultValues: toFormValues(member),
  });

  // Fields are disabled while saving, and a disabled field cannot take focus. After a failed save
  // the first field with a message gets it as soon as the form is enabled again; when only the
  // banner explains the failure, the banner does.
  const focusAfterSave = useRef(false);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const firstInvalid = Object.keys(errors)[0] as keyof MemberFormValues | undefined;
  useEffect(() => {
    if (!focusAfterSave.current || pending) return;
    focusAfterSave.current = false;
    if (firstInvalid) setFocus(firstInvalid);
    else formErrorRef.current?.focus();
  });

  const saveValues = async (values: MemberFormValues) => {
    setFormError(null);
    try {
      onSaved(await save(toMemberInput(values)));
    } catch (error) {
      setFormError(applyServerErrors(error, setError, MEMBER_FORM_FIELDS));
      focusAfterSave.current = true;
    }
  };

  return (
    <form
      noValidate
      aria-busy={pending}
      onSubmit={(event) => {
        void handleSubmit(saveValues)(event);
      }}
      className="grid gap-4"
    >
      {formError && <FormError ref={formErrorRef}>{formError}</FormError>}
      <fieldset disabled={pending} className="m-0 grid min-w-0 gap-4 border-0 p-0 sm:grid-cols-2">
        <FormField label="First name" required error={errors.firstName?.message}>
          {(field) => <Input {...field} autoComplete="off" {...register('firstName')} />}
        </FormField>
        <FormField label="Last name" required error={errors.lastName?.message}>
          {(field) => <Input {...field} autoComplete="off" {...register('lastName')} />}
        </FormField>
        <FormField label="Email" required error={errors.email?.message} className="sm:col-span-2">
          {(field) => <Input {...field} type="email" autoComplete="off" {...register('email')} />}
        </FormField>
        <FormField label="Phone" required error={errors.phone?.message}>
          {(field) => (
            <Input
              {...field}
              type="tel"
              autoComplete="off"
              placeholder="+380 44 123 45 67"
              {...register('phone')}
            />
          )}
        </FormField>
        <FormField label="Company" error={errors.company?.message}>
          {(field) => <Input {...field} autoComplete="off" {...register('company')} />}
        </FormField>
        <Controller
          control={control}
          name="plan"
          render={({ field }) => (
            <FormSelect
              label="Plan"
              required
              error={errors.plan?.message}
              options={PLAN_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <FormSelect
              label="Status"
              required
              error={errors.status?.message}
              options={STATUS_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />
      </fieldset>
      <FormDialogFooter pending={pending} submitLabel="Save" onCancel={onCancel} />
    </form>
  );
}
