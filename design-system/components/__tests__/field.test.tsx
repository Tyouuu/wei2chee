import { render, screen } from "@testing-library/react";
import { Field } from "../field";

test("label is associated with its control via a real id", () => {
  render(
    <Field label="Company name">
      {(id) => <input id={id} />}
    </Field>,
  );
  const input = screen.getByLabelText("Company name");
  expect(input).toBeInTheDocument();
});

test("error text is exposed via aria-describedby when the caller wires it", () => {
  render(
    <Field label="Company name" error="Required">
      {(id) => <input id={id} aria-describedby={`${id}-error`} />}
    </Field>,
  );
  const input = screen.getByLabelText("Company name");
  expect(input).toHaveAccessibleDescription("Required");
});
