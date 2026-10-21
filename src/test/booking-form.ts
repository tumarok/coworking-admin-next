import { fireEvent, screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { memberLabel, roomLabel } from '@/features/bookings/constants';
import { bookable, FREE_DAY } from '@/test/bookable';
import type { installMockApi } from '@/test/mock-api';
import { pickDate } from '@/test/pick-date';

type MockApi = ReturnType<typeof installMockApi>;
type User = ReturnType<typeof userEvent.setup>;

/** The form shows once the locations (and so the time zones) are known. */
export const formReady = async () => {
  const room = await screen.findByRole('combobox', { name: /^Room/ });
  // The dialog moves the focus to its first field a moment after it opens.
  await waitFor(() => {
    expect(room).toHaveFocus();
  });
};

export const pickRoom = async (user: User, api: MockApi, roomId: string, pause: () => void) => {
  const room = api.db.rooms.find((r) => r.id === roomId);
  const location = api.db.locations.find((l) => l.id === room?.locationId);
  if (!room || !location) throw new Error('no such room');
  const input = screen.getByRole('combobox', { name: /^Room/ });
  await user.click(input);
  await user.paste(room.name);
  pause();
  await user.click(
    await screen.findByRole('option', {
      name: roomLabel({ ...room, locationName: location.name }),
    }),
  );
};

export const pickMember = async (user: User, api: MockApi, email: string, pause: () => void) => {
  const member = api.db.members.find((m) => m.email === email);
  if (!member) throw new Error('no such member');
  const input = screen.getByRole('combobox', { name: /^Member/ });
  await user.click(input);
  await user.paste(email);
  pause();
  await user.click(await screen.findByRole('option', { name: memberLabel(member) }));
};

/** Sets a time field; a time input does not take typed text well in a test browser. */
export const setTime = (label: RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
};

/**
 * Fills the form with the room and member `bookable` found, on the free day; returns them. `pause`
 * is the one of `useFakeDebounce`: the drop-downs search after a pause in typing.
 */
export const fillNewBooking = async (
  user: User,
  api: MockApi,
  pause: () => void,
  options: Parameters<typeof bookable>[1] = {},
) => {
  const found = bookable(api, options);
  await formReady();
  await pickRoom(user, api, found.room.id, pause);
  await pickMember(user, api, found.member.email, pause);
  await pickDate(user, screen.getByRole('button', { name: /^Date/ }), FREE_DAY);
  return found;
};
