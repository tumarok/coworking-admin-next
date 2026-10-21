import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@/lib/contract/room';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { RoomFormDialog } from './room-form-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const EXISTING: Room = {
  id: 'room_7',
  locationId: 'loc_1',
  locationName: 'Riverside Hub',
  name: 'Iris',
  type: 'private_office',
  capacity: 5,
  hourlyRate: 2850,
  amenities: ['standing_desks', 'whiteboard'],
  status: 'available',
};

afterEach(() => {
  vi.clearAllMocks();
});

const setup = (room?: Room) => {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  const view = renderWithProviders(
    <RoomFormDialog open onOpenChange={onOpenChange} room={room} onSaved={onSaved} />,
  );
  return { ...view, onOpenChange, onSaved };
};

type User = ReturnType<typeof setup>['user'];

/** Searches the locations for `text` and picks the one that is left. */
const pickLocation = async (user: User, text: string, label: string) => {
  const input = screen.getByRole('combobox', { name: /^Location/ });
  await user.click(input);
  await user.type(input, text);
  await waitFor(() => {
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });
  await user.click(screen.getByRole('option', { name: label }));
};

const tick = async (user: User, ...labels: string[]) => {
  await user.click(screen.getByRole('combobox', { name: /^Amenities/ }));
  for (const label of labels) {
    await user.click(await screen.findByRole('option', { name: label }));
  }
  await user.keyboard('{Escape}');
};

const fillNew = async (user: User) => {
  await pickLocation(user, 'canal', 'Canal Yard (Berlin)');
  await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'Garden Annex');
};

describe('RoomFormDialog: creating', () => {
  it('opens empty with the defaults of a new room', () => {
    setup();

    expect(screen.getByRole('dialog', { name: 'New room' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^Location/ })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /^Type/ })).toHaveTextContent('Meeting room');
    expect(screen.getByRole('spinbutton', { name: /^Capacity/ })).toHaveValue(6);
    expect(screen.getByRole('spinbutton', { name: /^Hourly rate/ })).toHaveValue(25);
    expect(screen.getByRole('combobox', { name: /^Amenities/ })).toHaveTextContent('None');
    expect(screen.getByRole('combobox', { name: /^Status/ })).toHaveTextContent('Available');
  });

  it('saves with a searched location and amenities, sends the rate in cents and closes', async () => {
    const api = installMockApi({ via: 'bff' });
    const { user, onSaved, onOpenChange } = setup();

    await fillNew(user);
    await tick(user, 'Projector', 'Phone');
    const rate = screen.getByRole('spinbutton', { name: /^Hourly rate/ });
    await user.clear(rate);
    await user.type(rate, '32.5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      locationId: 'loc_4',
      locationName: 'Canal Yard',
      name: 'Garden Annex',
      type: 'meeting_room',
      capacity: 6,
      hourlyRate: 3250,
      amenities: ['projector', 'phone'],
      status: 'available',
    });
    expect(api.db.rooms.find((r) => r.name === 'Garden Annex')?.hourlyRate).toBe(3250);
    expect(toast.success).toHaveBeenCalledWith('Room created', { description: 'Garden Annex' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the validation messages under the fields, focuses the first and sends nothing', async () => {
    const requests: string[] = [];
    server.use(
      http.post('*/bff/rooms', () => {
        requests.push('post');
        return HttpResponse.json({});
      }),
    );
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Choose a location')).toBeInTheDocument();
    expect(screen.getByText('At least 2 characters')).toBeInTheDocument();
    const location = screen.getByRole('combobox', { name: /^Location/ });
    expect(location).toBeInvalid();
    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeInvalid();
    await waitFor(() => {
      expect(location).toHaveFocus();
    });
    expect(requests).toEqual([]);
  });

  it('wants a whole number of seats and a rate', async () => {
    installMockApi({ via: 'bff' });
    const { user } = setup();
    await fillNew(user);

    const capacity = screen.getByRole('spinbutton', { name: /^Capacity/ });
    await user.clear(capacity);
    await user.type(capacity, '0');
    await user.clear(screen.getByRole('spinbutton', { name: /^Hourly rate/ }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('At least 1 seat')).toBeInTheDocument();
    expect(screen.getByText('Enter a rate')).toBeInTheDocument();
    expect(capacity).toBeInvalid();
    expect(screen.getByRole('spinbutton', { name: /^Hourly rate/ })).toBeInvalid();
  });

  it('refuses a rate with part of a cent instead of rounding it', async () => {
    installMockApi({ via: 'bff' });
    const requests: string[] = [];
    server.use(
      http.post('*/bff/rooms', () => {
        requests.push('post');
        return HttpResponse.json({});
      }),
    );
    const { user } = setup();
    await fillNew(user);

    const rate = screen.getByRole('spinbutton', { name: /^Hourly rate/ });
    await user.clear(rate);
    await user.type(rate, '12.345');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('At most 2 decimals')).toBeInTheDocument();
    expect(rate).toBeInvalid();
    expect(requests).toEqual([]);
  });

  it('refuses a negative rate', async () => {
    installMockApi({ via: 'bff' });
    const { user } = setup();
    await fillNew(user);

    const rate = screen.getByRole('spinbutton', { name: /^Hourly rate/ });
    await user.clear(rate);
    await user.type(rate, '-3');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Cannot be negative')).toBeInTheDocument();
  });
});

describe('RoomFormDialog: editing', () => {
  it('opens with the values of the room, the rate in euros and the location by name', async () => {
    installMockApi({ via: 'bff' });
    setup(EXISTING);

    expect(screen.getByRole('dialog', { name: 'Edit Iris' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('Iris');
    expect(screen.getByRole('combobox', { name: /^Type/ })).toHaveTextContent('Private office');
    expect(screen.getByRole('spinbutton', { name: /^Capacity/ })).toHaveValue(5);
    expect(screen.getByRole('spinbutton', { name: /^Hourly rate/ })).toHaveValue(28.5);
    const amenities = screen.getByRole('combobox', { name: /^Amenities/ });
    expect(within(amenities).getByText('Standing desks')).toBeInTheDocument();
    expect(within(amenities).getByText('Whiteboard')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /^Location/ })).toHaveValue(
        'Riverside Hub (Kyiv)',
      );
    });
  });

  it('saves the change, moves the room to another location and says it was an update', async () => {
    const api = installMockApi({ via: 'bff' });
    const { user, onSaved } = setup(EXISTING);
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /^Location/ })).toHaveValue(
        'Riverside Hub (Kyiv)',
      );
    });

    const name = screen.getByRole('textbox', { name: /^Name/ });
    await user.clear(name);
    await user.type(name, 'Iris East');
    await user.tripleClick(screen.getByRole('combobox', { name: /^Location/ }));
    await user.keyboard('old mill');
    await waitFor(() => {
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });
    await user.click(screen.getByRole('option', { name: 'Old Mill Works (Kraków)' }));
    await tick(user, 'Projector');
    await user.click(screen.getByRole('combobox', { name: /^Status/ }));
    await user.click(await screen.findByRole('option', { name: 'Maintenance' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      id: 'room_7',
      name: 'Iris East',
      locationId: 'loc_3',
      locationName: 'Old Mill Works',
      hourlyRate: 2850,
      amenities: ['projector', 'whiteboard', 'standing_desks'],
      status: 'maintenance',
    });
    expect(api.db.rooms.find((r) => r.id === 'room_7')?.locationId).toBe('loc_3');
    expect(toast.success).toHaveBeenCalledWith('Room updated', { description: 'Iris East' });
  });

  it('starts from the saved values again after it was closed and reopened', async () => {
    installMockApi({ via: 'bff' });
    function Reopen() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button
            onClick={() => {
              setOpen(true);
            }}
          >
            reopen
          </button>
          <RoomFormDialog open={open} onOpenChange={setOpen} room={EXISTING} />
        </>
      );
    }
    const { user } = renderWithProviders(<Reopen />);
    await user.type(screen.getByRole('textbox', { name: /^Name/ }), ' changed');

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'reopen' }));

    expect(await screen.findByRole('textbox', { name: /^Name/ })).toHaveValue('Iris');
  });
});

describe('RoomFormDialog: failures', () => {
  it('puts a 422 under its field, focuses it and stays open', async () => {
    installMockApi({ via: 'bff' });
    server.use(
      http.post('*/bff/rooms', () =>
        HttpResponse.json(
          { message: 'Validation failed', fieldErrors: { name: 'This name is already in use' } },
          { status: 422 },
        ),
      ),
    );
    const { user, onSaved, onOpenChange } = setup();
    await fillNew(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('This name is already in use')).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: /^Name/ });
    expect(name).toBeInvalid();
    await waitFor(() => {
      expect(name).toHaveFocus();
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('names an unknown location of the room and lets the user pick another', async () => {
    installMockApi({ via: 'bff' });
    setup({ ...EXISTING, locationId: 'loc_gone' });

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: /^Location/ })).toHaveValue('Unknown location');
    });
    expect(screen.getByRole('combobox', { name: /^Location/ })).toBeInvalid();
  });

  it('puts "Location not found" under the location field', async () => {
    installMockApi({ via: 'bff' });
    server.use(
      http.post('*/bff/rooms', () =>
        HttpResponse.json(
          { message: 'Validation failed', fieldErrors: { locationId: 'Location not found' } },
          { status: 422 },
        ),
      ),
    );
    const { user } = setup();
    await fillNew(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Location not found')).toBeInTheDocument();
    const location = screen.getByRole('combobox', { name: /^Location/ });
    expect(location).toBeInvalid();
    await waitFor(() => {
      expect(location).toHaveFocus();
    });
  });

  it('shows any other failure as an alert in the form, not as a toast', async () => {
    installMockApi({ via: 'bff' });
    server.use(
      http.post('*/bff/rooms', () =>
        HttpResponse.json({ message: 'The server failed to save' }, { status: 500 }),
      ),
    );
    const { user, onOpenChange } = setup();
    await fillNew(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The server failed to save');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    // No field explains it, so the banner takes the focus from the button that was disabled.
    await waitFor(() => {
      expect(alert).toHaveFocus();
    });
  });

  it('locks the form and ignores Escape while the save is running', async () => {
    installMockApi({ via: 'bff' });
    // Held by hand: a timer would race a slow machine, and the save would end before Escape.
    const saveGate = Promise.withResolvers<undefined>();
    server.use(
      http.post('*/bff/rooms', async () => {
        await saveGate.promise;
        return undefined;
      }),
    );
    const { user, onOpenChange, onSaved } = setup();
    await fillNew(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('textbox', { name: /^Name/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    saveGate.resolve(undefined);
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
  });
});
