/**
 * Tests for the demo-credentials panel on the create-account page.
 *
 * The panel shows the seeded demo account, but it must not prefill a form that
 * could not succeed: that address is already registered (so submitting it is a
 * guaranteed 409) and the demo password has no symbol in it (so it fails the
 * signup policy). The assertions below pin that split, because "just fill it
 * all in" is the obvious wrong answer and the failure only shows up on submit.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { SignupPage } from "../SignupForm";
import { DEMO_ACCOUNT } from "../../../services/auth";

const valueOf = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement).value;

const renderSignup = () =>
  render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>
  );

describe("SignupPage demo panel", () => {
  it("shows the demo credentials", () => {
    renderSignup();

    // Email and password sit in one span as "email / password", so match on
    // content rather than on either half being its own element.
    const panel = screen.getByText(
      (_content, element) =>
        element?.tagName === "SPAN" &&
        element.textContent?.includes(DEMO_ACCOUNT.email) === true &&
        element.textContent?.includes(DEMO_ACCOUNT.password) === true
    );
    expect(panel.textContent).toContain(`${DEMO_ACCOUNT.email} / ${DEMO_ACCOUNT.password}`);
  });

  it("fills the fields a demo account can stand in for", () => {
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: "Fill in" }));

    expect(valueOf("Full name")).toBe("Demo Operator");
    expect(valueOf("Company")).toBe("LogiCraft");
    expect(valueOf("Primary role")).toBe("Operations Manager");
    expect((screen.getByLabelText(/I agree to the Terms/) as HTMLInputElement).checked).toBe(true);
  });

  it("leaves the email and both password fields empty", () => {
    renderSignup();
    fireEvent.click(screen.getByRole("button", { name: "Fill in" }));

    // The demo email is taken, and the demo password fails the signup policy, so
    // prefillng either would only hand the user a guaranteed error.
    expect(valueOf("Work email")).toBe("");
    expect(valueOf("Password")).toBe("");
    expect(valueOf("Confirm password")).toBe("");
  });

  it("points at the login page rather than implying the demo account can be created", () => {
    renderSignup();

    const link = screen.getByRole("link", { name: /sign in instead/i });
    expect(link.getAttribute("href")).toBe("/login");
  });
});
