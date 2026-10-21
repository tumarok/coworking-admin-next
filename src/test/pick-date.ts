import { fireEvent, screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const monthIndex = (year: number, month: number) => year * 12 + month - 1;

/**
 * Opens the calendar behind `trigger`, walks to the month of `isoDate` (a calendar opens on the
 * chosen day, or on the current month when there is none) and clicks the day.
 */
export const pickDate = async (
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement,
  isoDate: string,
) => {
  const [year = 0, month = 1, day = 1] = isoDate.split('-').map(Number);
  await user.click(trigger);
  const wanted = monthIndex(year, month);
  for (let step = 0; step < 120; step += 1) {
    const [name = '', shownYear = ''] = (
      (await screen.findByRole('grid')).getAttribute('aria-label') ?? ''
    ).split(' ');
    const shown = monthIndex(Number(shownYear), MONTHS.indexOf(name) + 1);
    if (shown === wanted) break;
    // A click of the test browser, not of the user: walking many months with real pointer
    // events is slow, and nothing here is about the pointer.
    fireEvent.click(
      screen.getByRole('button', {
        name: shown < wanted ? 'Go to the Next Month' : 'Go to the Previous Month',
      }),
    );
  }
  fireEvent.click(
    screen.getByRole('button', {
      name: new RegExp(`^\\w+, ${MONTHS[month - 1]} ${day}(st|nd|rd|th), ${year}$`),
    }),
  );
};
