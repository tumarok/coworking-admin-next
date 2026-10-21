'use client';

import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { AsyncCombobox } from '@/components/async-combobox';
import { DatePicker } from '@/components/date-picker';
import { FormDialog, FormDialogFooter, FormError } from '@/components/form-dialog';
import { FormField } from '@/components/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/errors';
import type { Booking, BookingInput } from '@/lib/contract/booking';
import type { BookingConflict } from '@/lib/contract/common';
import { applyServerErrors } from '@/lib/form';
import { useCreateBooking, useUpdateBooking } from '@/features/bookings/api/booking-mutations';
import {
  bookableMemberOptionsQuery,
  bookableRoomOptionsQuery,
  memberOptionQuery,
  roomOptionQuery,
} from '@/features/bookings/api/booking-queries';
import { useLocationZones } from '@/features/bookings/api/booking-zones';
import { BookingConflicts } from '@/features/bookings/components/booking-conflicts';
import { memberLabel, roomLabel } from '@/features/bookings/constants';
import {
  BOOKING_FIELD_ALIASES,
  BOOKING_FORM_FIELDS,
  bookingFormSchema,
  seatsError,
  spansDays,
  toBookingInput,
  toFormValues,
  type BookingFormValues,
} from '@/features/bookings/schemas';

interface BookingFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The booking to edit; without it the dialog creates one. */
  booking?: Booking | undefined;
  onSaved?: (booking: Booking) => void;
}

type Zones = ReturnType<typeof useLocationZones>;

const MULTI_DAY_MESSAGE =
  'This booking ends on another day than it starts. The form cannot show that, and saving would shorten it.';

/** Create or edit a booking. Stays open when the save fails and says why. */
export function BookingFormDialog({
  open,
  onOpenChange,
  booking,
  onSaved,
}: BookingFormDialogProps) {
  const create = useCreateBooking();
  const update = useUpdateBooking(booking?.id ?? '');
  const mutation = booking ? update : create;
  // The times of a booking are the clock of its location: the form waits for the zones.
  const zones = useLocationZones();

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={booking ? 'Edit booking' : 'New booking'}
      pending={mutation.isPending}
      className="sm:max-w-2xl"
    >
      {zones.ready ? (
        <BookingForm
          booking={booking}
          zones={zones}
          pending={mutation.isPending}
          save={mutation.mutateAsync}
          onCancel={() => {
            onOpenChange(false);
          }}
          onSaved={(saved) => {
            toast.success(booking ? 'Booking updated' : 'Booking created');
            onOpenChange(false);
            onSaved?.(saved);
          }}
        />
      ) : (
        <div role="status" aria-label="Loading the form" className="grid gap-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}
    </FormDialog>
  );
}

interface BookingFormProps {
  booking: Booking | undefined;
  zones: Zones;
  pending: boolean;
  save: (input: BookingInput) => Promise<Booking>;
  onCancel: () => void;
  onSaved: (booking: Booking) => void;
}

// Mounted only while the dialog is open, so every opening starts from the booking's values.
function BookingForm({ booking, zones, pending, save, onCancel, onSaved }: BookingFormProps) {
  const bookingZone = booking && zones.zoneOf(booking.locationId);
  const multiDay = !!booking && spansDays(booking, bookingZone);
  const [formError, setFormError] = useState<string | null>(multiDay ? MULTI_DAY_MESSAGE : null);
  // Bookings that hold the room, with the zone their times were typed in.
  const [conflicts, setConflicts] = useState<{
    items: BookingConflict[];
    timeZone: string;
  } | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    mode: 'onTouched',
    defaultValues: toFormValues(booking, bookingZone),
  });

  // The room decides the zone of the times, the seats and the opening hours.
  const roomId = useWatch({ control, name: 'roomId' });
  const room = useQuery({ ...roomOptionQuery(roomId), enabled: roomId !== '' }).data;
  const location = room && zones.locations?.find((l) => l.id === room.locationId);

  // The form may appear after the dialog opened (it waits for the zones), when the dialog has
  // already placed the focus on its frame.
  useEffect(() => {
    setFocus('roomId');
  }, [setFocus]);

  // Fields are disabled while saving, and a disabled field cannot take focus. After a failed save
  // the first field with a message gets it as soon as the form is enabled again; when only a
  // banner explains the failure, the banner does.
  const focusAfterSave = useRef(false);
  const formErrorRef = useRef<HTMLParagraphElement>(null);
  const conflictsRef = useRef<HTMLDivElement>(null);
  const firstInvalid = Object.keys(errors)[0] as keyof BookingFormValues | undefined;
  useEffect(() => {
    if (!focusAfterSave.current || pending) return;
    focusAfterSave.current = false;
    if (firstInvalid) setFocus(firstInvalid);
    else (conflictsRef.current ?? formErrorRef.current)?.focus();
  });

  const saveValues = async (values: BookingFormValues) => {
    setConflicts(null);
    if (multiDay) {
      setFormError(MULTI_DAY_MESSAGE);
      focusAfterSave.current = true;
      return;
    }
    setFormError(null);
    const timeZone = room && zones.zoneOf(room.locationId);
    const seats = room && seatsError(values.attendees, room.capacity);
    if (seats) {
      setError('attendees', { type: 'validate', message: seats }, { shouldFocus: true });
      return;
    }
    if (!timeZone) {
      setFormError("Could not find the time zone of the room's location. Try again.");
      focusAfterSave.current = true;
      return;
    }
    try {
      onSaved(await save(toBookingInput(values, timeZone)));
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && error.conflicts?.length) {
        setConflicts({ items: error.conflicts, timeZone });
      } else {
        setFormError(
          applyServerErrors(error, setError, BOOKING_FORM_FIELDS, BOOKING_FIELD_ALIASES),
        );
      }
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
      {conflicts && (
        <BookingConflicts
          ref={conflictsRef}
          conflicts={conflicts.items}
          timeZone={conflicts.timeZone}
        />
      )}
      <fieldset disabled={pending} className="m-0 grid min-w-0 gap-4 border-0 p-0 sm:grid-cols-2">
        <Controller
          control={control}
          name="roomId"
          render={({ field }) => (
            <FormField
              label="Room"
              required
              error={errors.roomId?.message}
              className="sm:col-span-2"
            >
              {(control) => (
                <AsyncCombobox
                  {...control}
                  placeholder="Choose a room"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  searchOptions={bookableRoomOptionsQuery}
                  itemOptions={roomOptionQuery}
                  getValue={(item) => item.id}
                  getLabel={roomLabel}
                  unknownLabel="Unknown room"
                  triggerLabel="Show rooms"
                  emptyText="No rooms found"
                />
              )}
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="memberId"
          render={({ field }) => (
            <FormField
              label="Member"
              required
              error={errors.memberId?.message}
              className="sm:col-span-2"
            >
              {(control) => (
                <AsyncCombobox
                  {...control}
                  placeholder="Choose a member"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  searchOptions={bookableMemberOptionsQuery}
                  itemOptions={memberOptionQuery}
                  getValue={(item) => item.id}
                  getLabel={memberLabel}
                  unknownLabel="Unknown member"
                  triggerLabel="Show members"
                  emptyText="No members found"
                />
              )}
            </FormField>
          )}
        />
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <FormField
              label="Date"
              required
              error={errors.date?.message}
              hint={
                location
                  ? `${location.name} local time (${location.timezone}), open ${location.opensAt}–${location.closesAt}`
                  : booking && !bookingZone
                    ? 'The time zone of the location is unknown, so the times are shown in UTC.'
                    : undefined
              }
              className="sm:col-span-2"
            >
              {(control) => (
                <DatePicker
                  {...control}
                  label="Date"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            </FormField>
          )}
        />
        <FormField label="From" required error={errors.startTime?.message}>
          {(field) => <Input {...field} type="time" step={900} {...register('startTime')} />}
        </FormField>
        <FormField label="To" required error={errors.endTime?.message}>
          {(field) => <Input {...field} type="time" step={900} {...register('endTime')} />}
        </FormField>
        <FormField
          label="Attendees"
          required
          error={errors.attendees?.message}
          hint={room ? `Seats up to ${room.capacity}` : undefined}
        >
          {(field) => (
            <Input
              {...field}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              {...register('attendees', { valueAsNumber: true })}
            />
          )}
        </FormField>
        <FormField label="Notes" error={errors.notes?.message} className="sm:col-span-2">
          {(field) => <Textarea {...field} rows={3} {...register('notes')} />}
        </FormField>
      </fieldset>
      <FormDialogFooter pending={pending} submitLabel="Save" onCancel={onCancel} />
    </form>
  );
}
