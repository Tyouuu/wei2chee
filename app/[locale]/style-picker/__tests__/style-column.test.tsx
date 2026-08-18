import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { StyleColumn } from "../style-column";
import messages from "@/messages/en.json";

// StyleColumn always renders <SampleContent />, which calls useTranslations
// internally -- so every render here needs a real i18n context, not just the
// StyleColumn-level props under test. Using the app's real en.json (rather
// than a hand-rolled stub) means this can't silently drift out of sync with
// the keys SampleContent actually reads.
function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

test("renders a WhatsApp link when no onSelect is given (existing public-page behavior)", () => {
  renderWithIntl(
    <StyleColumn
      styleName="ledger"
      label="Ledger"
      description="desc"
      selectCta="选这个风格"
      whatsappPrefillText="我选择 Ledger 风格"
    />,
  );
  const link = screen.getByTestId("style-picker-select-ledger");
  expect(link.tagName).toBe("A");
  expect(link).toHaveAttribute("href", expect.stringContaining("wa.me"));
});

test("renders a button and calls onSelect when onSelect is given (portal behavior)", () => {
  const onSelect = vi.fn();
  renderWithIntl(
    <StyleColumn
      styleName="hearth"
      label="Hearth"
      description="desc"
      selectCta="选这个风格"
      onSelect={onSelect}
    />,
  );
  const button = screen.getByTestId("style-picker-select-hearth");
  expect(button.tagName).toBe("BUTTON");
  fireEvent.click(button);
  expect(onSelect).toHaveBeenCalledTimes(1);
});
