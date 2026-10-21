import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { QUERY_ROOTS } from '@/config/query-roots';
import { api } from '@/lib/api/client';
import {
  bookingSchema,
  type Booking,
  type BookingInput,
  type BookingStatus,
} from '@/lib/contract/booking';
import { replaceInLists } from '@/lib/query-cache';
import { bookingKeys } from '@/features/bookings/api/booking-keys';

// The dashboard counts bookings by day and status. Not awaited: the caller must not wait for it.
const invalidateDashboard = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.dashboard] });
};

// The forms and the confirm dialog show these errors themselves: `silent` turns the toast off.
const SILENT = { silent: true };

/** Stores the answer where the booking is printed, then refreshes everything that may differ. */
const storeSaved = (queryClient: QueryClient, booking: Booking) => {
  queryClient.setQueryData(bookingKeys.detail(booking.id), booking);
  replaceInLists(queryClient, { queryKey: bookingKeys.lists() }, booking);
  void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
  invalidateDashboard(queryClient);
};

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BookingInput) => api.post('bookings', bookingSchema, { body: input }),
    meta: SILENT,
    onSuccess: (booking) => {
      storeSaved(queryClient, booking);
    },
  });
};

export const useUpdateBooking = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BookingInput) =>
      api.patch(`bookings/${encodeURIComponent(id)}`, bookingSchema, { body: input }),
    meta: SILENT,
    onSuccess: (booking) => {
      storeSaved(queryClient, booking);
    },
  });
};

/** Moves the booking to the next status; the caller explains a refusal (409). */
export const useChangeBookingStatus = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: BookingStatus) =>
      api.post(`bookings/${encodeURIComponent(id)}/status`, bookingSchema, { body: { status } }),
    meta: SILENT,
    onSuccess: (booking) => {
      storeSaved(queryClient, booking);
    },
  });
};
