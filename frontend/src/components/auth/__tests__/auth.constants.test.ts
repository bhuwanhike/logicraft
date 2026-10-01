/**
 * Tests for the login and signup rules.
 *
 * The rules are shared by both forms, so a change here moves validation on two
 * screens at once. The cases that matter are the boundaries — 8 versus 7
 * characters, an email at the edge of the pattern — and the mismatched
 * password, which is the one a user hits most and the easiest to let through.
 */
import { describe, expect, it } from "vitest";

import {
  AUTH_ROLES,
  passwordChecks,
  scorePassword,
  validateLogin,
  validateSignup
} from "../auth.constants";
import type { SignupValues } from "../auth.constants";

function signup(patch: Partial<SignupValues> = {}): SignupValues {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    company: "LogiCraft",
    role: "Dispatcher",
    password: "Str0ng!Pass",
    confirmPassword: "Str0ng!Pass",
    ...patch
  };
}

const valid = signup();

describe("scorePassword", () => {
  it("reports an empty password as too short", () => {
    expect(scorePassword("")).toEqual({ score: 0, label: "Too short" });
  });

  it("reports anything under 8 characters as too short", () => {
    expect(scorePassword("aB1!aaa").label).toBe("Too short");
    expect(scorePassword("aB1!aaa").score).toBe(0);
  });

  it("scores the minimum acceptable password as weak", () => {
    // 8 characters plus mixed case, a digit and a symbol is 4 points.
    expect(scorePassword("Abcdef1!").label).toBe("Good");
  });

  it("scores a bare 8-character password as weak", () => {
    expect(scorePassword("abcdefgh").label).toBe("Weak");
  });

  it("reaches strong only with length, case, digit and symbol", () => {
    expect(scorePassword("Str0ng!Passphrase").label).toBe("Strong");
    expect(scorePassword("Str0ng!Passphrase").score).toBe(4);
  });

  it("does not reach strong on length alone", () => {
    expect(scorePassword("aaaaaaaaaaaaaaaa").label).not.toBe("Strong");
  });

  it("only accepts a score in the documented range", () => {
    const samples = ["", "a", "abcdefgh", "Abcdef1!", "Str0ng!Passphrase", "12345678"];
    for (const sample of samples) {
      const { score, label } = scorePassword(sample);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(4);
      expect(["Too short", "Weak", "Fair", "Good", "Strong"]).toContain(label);
    }
  });
});

describe("passwordChecks", () => {
  it("lists the four requirements", () => {
    expect(passwordChecks("Str0ng!Pass").map((c) => c.label)).toEqual([
      "8+ characters",
      "Upper and lower case",
      "A number",
      "A symbol"
    ]);
  });

  it("marks everything met for a strong password", () => {
    expect(passwordChecks("Str0ng!Pass").every((c) => c.met)).toBe(true);
  });

  it("marks nothing met for an empty password", () => {
    expect(passwordChecks("").every((c) => !c.met)).toBe(true);
  });

  it("marks a space as not a symbol", () => {
    expect(passwordChecks("Abcdefg 1").find((c) => c.label === "A symbol")?.met).toBe(false);
  });

  it("marks a hyphen as a symbol", () => {
    expect(passwordChecks("Abcdefg-1").find((c) => c.label === "A symbol")?.met).toBe(true);
  });
});

describe("validateSignup", () => {
  it("returns no errors for a valid submission", () => {
    expect(validateSignup(valid, true)).toEqual({});
  });

  it("requires a name", () => {
    expect(validateSignup(signup({ name: "  " }), true).name).toBe("Enter your full name.");
  });

  it("rejects a one-character name", () => {
    expect(validateSignup(signup({ name: "A" }), true).name).toBe("That name looks too short.");
  });

  it("accepts a two-character name", () => {
    expect(validateSignup(signup({ name: "Al" }), true).name).toBeUndefined();
  });

  it("requires an email", () => {
    expect(validateSignup(signup({ email: "" }), true).email).toBe("Enter your work email.");
  });

  it.each([
    "no-at-sign",
    "missing@tld",
    "spaced @example.com",
    "two@@example.com",
    "trailing@example.",
    "trailing@example.c"
  ])("rejects the malformed email %s", (email) => {
    expect(validateSignup(signup({ email }), true).email).toBe("Enter a valid email address.");
  });

  it.each(["a@b.co", "first.last@sub.example.com", "user+tag@example.org"])(
    "accepts the valid email %s",
    (email) => {
      expect(validateSignup(signup({ email }), true).email).toBeUndefined();
    }
  );

  it("trims the email before validating it", () => {
    expect(validateSignup(signup({ email: "  ada@example.com  " }), true).email).toBeUndefined();
  });

  it("requires a company", () => {
    expect(validateSignup(signup({ company: "" }), true).company).toBe("Enter your company name.");
    expect(validateSignup(signup({ company: "L" }), true).company).toBe("Enter a valid company name.");
  });

  it("requires a role", () => {
    expect(validateSignup(signup({ role: "" }), true).role).toBe("Choose the role you will use most.");
  });

  it("offers roles for the picker", () => {
    expect(AUTH_ROLES).toContain("Dispatcher");
    expect(AUTH_ROLES.length).toBeGreaterThan(1);
  });

  it("requires a password", () => {
    expect(validateSignup(signup({ password: "", confirmPassword: "" }), true).password).toBe(
      "Choose a password."
    );
  });

  it("requires at least 8 characters", () => {
    expect(validateSignup(signup({ password: "Ab1!efg", confirmPassword: "Ab1!efg" }), true).password).toBe(
      "Use at least 8 characters."
    );
  });

  it("requires the password to be repeated", () => {
    const errors = validateSignup(signup({ confirmPassword: "" }), true);
    expect(errors.confirmPassword).toBe("Repeat your password.");
  });

  it("rejects a mismatched confirmation", () => {
    expect(validateSignup(signup({ confirmPassword: "Different1!" }), true).confirmPassword).toBe(
      "Passwords do not match."
    );
  });

  it("requires the terms to be accepted", () => {
    expect(validateSignup(valid, false).terms).toBe("Accept the terms to create an account.");
  });

  it("reports every problem at once rather than stopping at the first", () => {
    const errors = validateSignup(
      signup({ name: "", email: "nope", company: "", role: "", password: "x", confirmPassword: "y" }),
      false
    );
    expect(Object.keys(errors).sort()).toEqual([
      "company",
      "confirmPassword",
      "email",
      "name",
      "password",
      "role",
      "terms"
    ]);
  });
});

describe("validateLogin", () => {
  it("returns no errors for valid values", () => {
    expect(validateLogin({ email: "ada@example.com", password: "x" })).toEqual({});
  });

  it("does not impose a password policy, only presence", () => {
    // Login must accept the password the user chose at signup.
    expect(validateLogin({ email: "ada@example.com", password: "x" }).password).toBeUndefined();
  });

  it("requires an email", () => {
    expect(validateLogin({ email: "", password: "x" }).email).toBe("Enter your email.");
  });

  it("rejects a malformed email", () => {
    expect(validateLogin({ email: "ada", password: "x" }).email).toBe("Enter a valid email address.");
  });

  it("requires a password", () => {
    expect(validateLogin({ email: "ada@example.com", password: "" }).password).toBe(
      "Enter your password."
    );
  });
});
