import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { QUERY_ROOTS } from '@/config/query-roots';
import { api } from '@/lib/api/client';
import {
  bookingSchema,
  bulkBookingResultSchema,
  type Booking,
  type BookingInput,
  type BookingStatus,
  type BulkBookingRequest,
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

/**
 * Confirms or cancels many bookings at once. The answer is `200` even when some are refused, so
 * the caller reads `failed`. The response holds ids only: the lists and the page of every booking
 * named in it are fetched again (a refusal means what the screen showed was out of date), and the
 * dashboard only when a booking really changed.
 */
export const useBulkBookings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: BulkBookingRequest) =>
      api.post('bookings/bulk', bulkBookingResultSchema, { body: request }),
    meta: SILENT,
    onSuccess: ({ updated, failed }) => {
      void queryClient.invalidateQueries({ queryKey: bookingKeys.lists() });
      for (const id of [...updated, ...failed.map((item) => item.id)]) {
        void queryClient.invalidateQueries({ queryKey: bookingKeys.detail(id) });
      }
      if (updated.length > 0) invalidateDashboard(queryClient);
    },
  });
};
