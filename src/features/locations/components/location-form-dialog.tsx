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
import type { Location } from '@/lib/contract/location';
import { useCreateLocation, useUpdateLocation } from '@/features/locations/api/location-mutations';
import { STATUS_OPTIONS, TIMEZONE_OPTIONS } from '@/features/locations/constants';
import {
  LOCATION_FORM_FIELDS,
  locationFormSchema,
  toFormValues,
  type LocationFormValues,
} from '@/features/locations/schemas';

interface LocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The location to edit; without it the dialog creates one. */
  location?: Location | undefined;
  onSaved?: (location: Location) => void;
}

/** Create or edit a location. Stays open when the save fails and says why. */
export function LocationFormDialog({
  open,
  onOpenChange,
  location,
  onSaved,
}: LocationFormDialogProps) {
  const create = useCreateLocation();
  const update = useUpdateLocation(location?.id ?? '');
  const mutation = location ? update : create;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={location ? `Edit ${location.name}` : 'New location'}
      pending={mutation.isPending}
    >
      <LocationForm
        location={location}
        pending={mutation.isPending}
        save={mutation.mutateAsync}
        onCancel={() => {
          onOpenChange(false);
        }}
        onSaved={(saved) => {
          toast.success(location ? 'Location updated' : 'Location created', {
            description: saved.name,
          });
          onOpenChange(false);
          onSaved?.(saved);
        }}
      />
    </FormDialog>
  );
}

interface LocationFormProps {
  location: Location | undefined;
  pending: boolean;
  save: (values: LocationFormValues) => Promise<Location>;
  onCancel: () => void;
  onSaved: (location: Location) => void;
}

// Mounted only while the dialog is open, so every opening starts from the location's values.
function LocationForm({ location, pending, save, onCancel, onSaved }: LocationFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    mode: 'onTouched',
    defaultValues: toFormValues(location),
  });

  // Fields are disabled while saving, and a disabled field cannot take focus. After a failed save
  // the first field with a message gets it as soon as the form is enabled again; when only the
  // banner explains the failure, the banner does.
  const focusAfterSave = useRef(false);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const firstInvalid = Object.keys(errors)[0] as keyof LocationFormValues | undefined;
  useEffect(() => {
    if (!focusAfterSave.current || pending) return;
    // The form unlocks and the failure shows in renders of their own, in either order. Keep the
    // request until the render that has the field message or the banner.
    if (firstInvalid) setFocus(firstInvalid);
    else if (formErrorRef.current) formErrorRef.current.focus();
    else return;
    focusAfterSave.current = false;
  });

  const saveValues = async (values: LocationFormValues) => {
    setFormError(null);
    try {
      onSaved(await save(values));
    } catch (error) {
      setFormError(applyServerErrors(error, setError, LOCATION_FORM_FIELDS));
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
        <FormField label="Name" required error={errors.name?.message}>
          {(field) => <Input {...field} autoComplete="off" {...register('name')} />}
        </FormField>
        <FormField label="City" required error={errors.city?.message}>
          {(field) => <Input {...field} autoComplete="off" {...register('city')} />}
        </FormField>
        <FormField
          label="Address"
          required
          error={errors.address?.message}
          className="sm:col-span-2"
        >
          {(field) => <Input {...field} autoComplete="off" {...register('address')} />}
        </FormField>
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <FormSelect
              label="Time zone"
              required
              error={errors.timezone?.message}
              options={TIMEZONE_OPTIONS}
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
        <FormField label="Opens at" required error={errors.opensAt?.message}>
          {(field) => <Input {...field} type="time" step={900} {...register('opensAt')} />}
        </FormField>
        <FormField label="Closes at" required error={errors.closesAt?.message}>
          {(field) => <Input {...field} type="time" step={900} {...register('closesAt')} />}
        </FormField>
      </fieldset>
      <FormDialogFooter pending={pending} submitLabel="Save" onCancel={onCancel} />
    </form>
  );
}
