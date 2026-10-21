import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { toast } from 'sonner';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Location } from '@/lib/contract/location';
import { installMockApi } from '@/test/mock-api';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render-with-providers';
import { LocationFormDialog } from './location-form-dialog';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const EXISTING: Location = {
  id: 'loc_1',
  name: 'Riverside Hub',
  city: 'Kyiv',
  address: '12 Naberezhna St',
  timezone: 'Europe/Kyiv',
  opensAt: '08:00',
  closesAt: '21:00',
  status: 'active',
  roomCount: 6,
};

afterEach(() => {
  vi.clearAllMocks();
});

const setup = (location?: Location) => {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  const view = renderWithProviders(
    <LocationFormDialog open onOpenChange={onOpenChange} location={location} onSaved={onSaved} />,
  );
  return { ...view, onOpenChange, onSaved };
};

const fillNew = async (user: ReturnType<typeof setup>['user']) => {
  await user.type(screen.getByRole('textbox', { name: /^Name/ }), 'Garden Annex');
  await user.type(screen.getByRole('textbox', { name: /^City/ }), 'Vienna');
  await user.type(screen.getByRole('textbox', { name: /^Address/ }), '5 Ring Strasse');
};

describe('LocationFormDialog: creating', () => {
  it('opens empty with the defaults of a new location', () => {
    setup();

    expect(screen.getByRole('dialog', { name: 'New location' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('');
    expect(screen.getByRole('combobox', { name: /^Time zone/ })).toHaveTextContent('Europe/Kyiv');
    expect(screen.getByRole('combobox', { name: /^Status/ })).toHaveTextContent('Active');
    expect(screen.getByLabelText(/^Opens at/)).toHaveValue('08:00');
    expect(screen.getByLabelText(/^Closes at/)).toHaveValue('20:00');
  });

  it('saves, announces it, reports the new location and closes', async () => {
    installMockApi({ via: 'bff' });
    const { user, onSaved, onOpenChange } = setup();

    await fillNew(user);
    await user.click(screen.getByRole('combobox', { name: /^Time zone/ }));
    await user.click(await screen.findByRole('option', { name: 'Europe/Berlin' }));
    fireEvent.change(screen.getByLabelText(/^Opens at/), { target: { value: '09:00' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      name: 'Garden Annex',
      city: 'Vienna',
      timezone: 'Europe/Berlin',
      opensAt: '09:00',
      closesAt: '20:00',
      roomCount: 0,
    });
    expect(toast.success).toHaveBeenCalledWith('Location created', { description: 'Garden Annex' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows the validation messages under the fields and sends nothing', async () => {
    const requests: string[] = [];
    server.use(
      http.post('*/bff/locations', () => {
        requests.push('post');
        return HttpResponse.json({});
      }),
    );
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Save' }));

    const name = screen.getByRole('textbox', { name: /^Name/ });
    expect(await screen.findAllByText('At least 2 characters')).toHaveLength(2);
    expect(screen.getByText('At least 5 characters')).toBeInTheDocument();
    expect(name).toBeInvalid();
    await waitFor(() => {
      expect(name).toHaveFocus();
    });
    expect(requests).toEqual([]);
  });

  it('wants the closing time after the opening time', async () => {
    const { user } = setup();
    await fillNew(user);

    fireEvent.change(screen.getByLabelText(/^Closes at/), { target: { value: '07:00' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Closing time must be after opening time')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Closes at/)).toBeInvalid();
  });
});

describe('LocationFormDialog: editing', () => {
  it('opens with the values of the location', () => {
    setup(EXISTING);

    expect(screen.getByRole('dialog', { name: 'Edit Riverside Hub' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Name/ })).toHaveValue('Riverside Hub');
    expect(screen.getByRole('textbox', { name: /^Address/ })).toHaveValue('12 Naberezhna St');
    expect(screen.getByLabelText(/^Closes at/)).toHaveValue('21:00');
  });

  it('saves the change and says it was an update', async () => {
    installMockApi({ via: 'bff' });
    const { user, onSaved } = setup(EXISTING);

    const name = screen.getByRole('textbox', { name: /^Name/ });
    await user.clear(name);
    await user.type(name, 'Riverside Hub East');
    await user.click(screen.getByRole('combobox', { name: /^Status/ }));
    await user.click(await screen.findByRole('option', { name: 'Inactive' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({
      id: 'loc_1',
      name: 'Riverside Hub East',
      status: 'inactive',
    });
    expect(toast.success).toHaveBeenCalledWith('Location updated', {
      description: 'Riverside Hub East',
    });
  });

  it('starts from the saved values again after it was closed and reopened', async () => {
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
          <LocationFormDialog open={open} onOpenChange={setOpen} location={EXISTING} />
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

    expect(await screen.findByRole('textbox', { name: /^Name/ })).toHaveValue('Riverside Hub');
  });
});

describe('LocationFormDialog: failures', () => {
  it('puts a 422 under its field, focuses it and stays open', async () => {
    server.use(
      http.post('*/bff/locations', () =>
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

  it('shows any other failure as an alert in the form, not as a toast', async () => {
    server.use(
      http.post('*/bff/locations', () =>
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

  it('can be saved again after a failure', async () => {
    let attempts = 0;
    installMockApi({ via: 'bff' });
    server.use(
      http.post('*/bff/locations', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({ message: 'The server failed to save' }, { status: 500 })
          : undefined;
      }),
    );
    const { user, onSaved } = setup();
    await fillNew(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('locks the form and ignores Escape while the save is running', async () => {
    installMockApi({ via: 'bff' });
    server.use(
      http.post('*/bff/locations', async () => {
        await delay(150);
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
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledOnce();
    });
  });
});
