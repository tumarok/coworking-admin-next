/** `checked_in` -> `Checked in`: turns an API enum value into a label. */
export const humanize = (value: string) => {
  const spaced = value.replaceAll('_', ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};
