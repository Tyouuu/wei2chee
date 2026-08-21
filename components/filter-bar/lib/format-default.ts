const SHORT = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

const LONG = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const defaultFormatDate = (date: Date): string => LONG.format(date);

export const defaultFormatDateRange = ({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): string => `${SHORT.format(from)} - ${SHORT.format(to)}`;
