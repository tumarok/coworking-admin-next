'use client';

import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { AsyncCombobox } from '@/components/async-combobox';
import { FormDialog, FormDialogFooter, FormError } from '@/components/form-dialog';
import { FormField } from '@/components/form-field';
import { FormSelect } from '@/components/form-select';
import { MultiSelect } from '@/components/multi-select';
import { Input } from '@/components/ui/input';
import { applyServerErrors } from '@/lib/form';
import type { Room } from '@/lib/contract/room';
import { useCreateRoom, useUpdateRoom } from '@/features/rooms/api/room-mutations';
import { locationOptionQuery, locationOptionsQuery } from '@/features/rooms/api/room-queries';
import {
  AMENITY_OPTIONS,
  locationLabel,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from '@/features/rooms/constants';
import {
  ROOM_FORM_FIELDS,
  roomFormSchema,
  toFormValues,
  toRoomInput,
  type RoomFormValues,
} from '@/features/rooms/schemas';

interface RoomFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The room to edit; without it the dialog creates one. */
  room?: Room | undefined;
  onSaved?: (room: Room) => void;
}

/** Create or edit a room. Stays open when the save fails and says why. */
export function RoomFormDialog({ open, onOpenChange, room, onSaved }: RoomFormDialogProps) {
  const create = useCreateRoom();
  const update = useUpdateRoom(room?.id ?? '');
  const mutation = room ? update : create;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={room ? `Edit ${room.name}` : 'New room'}
      pending={mutation.isPending}
    >
      <RoomForm
        room={room}
        pending={mutation.isPending}
        save={mutation.mutateAsync}
        onCancel={() => {
          onOpenChange(false);
        }}
        onSaved={(saved) => {
          toast.success(room ? 'Room updated' : 'Room created', { description: saved.name });
          onOpenChange(false);
          onSaved?.(saved);
        }}
      />
    </FormDialog>
  );
}

interface RoomFormProps {
  room: Room | undefined;
  pending: boolean;
  save: (input: ReturnType<typeof toRoomInput>) => Promise<Room>;
  onCancel: () => void;
  onSaved: (room: Room) => void;
}

// Mounted only while the dialog is open, so every opening starts from the room's values.
function RoomForm({ room, pending, save, onCancel, onSaved }: RoomFormProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<RoomFormValues>({
    resolver: zodResolver(roomFormSchema),
    mode: 'onTouched',
    defaultValues: toFormValues(room),
  });

  // Fields are disabled while saving, and a disabled field cannot take focus. After a failed save
  // the first field with a message gets it as soon as the form is enabled again; when only the
  // banner explains the failure, the banner does.
  const focusAfterSave = useRef(false);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const firstInvalid = Object.keys(errors)[0] as keyof RoomFormValues | undefined;
  useEffect(() => {
    if (!focusAfterSave.current || pending) return;
    focusAfterSave.current = false;
    if (firstInvalid) setFocus(firstInvalid);
    else formErrorRef.current?.focus();
  });

  const saveValues = async (values: RoomFormValues) => {
    setFormError(null);
    try {
      onSaved(await save(toRoomInput(values)));
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ROOM_FORM_FIELDS));
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
        <Controller
          control={control}
          name="locationId"
          render={({ field }) => (
            <FormField
              label="Location"
              required
              error={errors.locationId?.message}
              className="sm:col-span-2"
            >
              {(control) => (
                <AsyncCombobox
                  {...control}
                  placeholder="Search locations"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  searchOptions={locationOptionsQuery}
                  itemOptions={locationOptionQuery}
                  getValue={(location) => location.id}
                  getLabel={locationLabel}
                  unknownLabel="Unknown location"
                  triggerLabel="Show locations"
                  emptyText="No locations found"
                />
              )}
            </FormField>
          )}
        />
        <FormField label="Name" required error={errors.name?.message}>
          {(field) => <Input {...field} autoComplete="off" {...register('name')} />}
        </FormField>
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <FormSelect
              label="Type"
              required
              error={errors.type?.message}
              options={TYPE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          )}
        />
        <FormField label="Capacity" required error={errors.capacity?.message} hint="Seats">
          {(field) => (
            <Input
              {...field}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              {...register('capacity', { valueAsNumber: true })}
            />
          )}
        </FormField>
        <FormField
          label="Hourly rate"
          required
          error={errors.hourlyRate?.message}
          hint="Euros per hour"
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              {...register('hourlyRate', { valueAsNumber: true })}
            />
          )}
        </FormField>
        <Controller
          control={control}
          name="amenities"
          render={({ field }) => (
            <FormField
              label="Amenities"
              error={errors.amenities?.message}
              className="sm:col-span-2"
            >
              {(control) => (
                <MultiSelect
                  {...control}
                  options={AMENITY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            </FormField>
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
