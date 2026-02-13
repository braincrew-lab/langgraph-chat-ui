import ko from "./messages/ko.json";

type Messages = typeof ko;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}
