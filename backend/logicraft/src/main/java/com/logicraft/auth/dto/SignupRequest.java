package com.logicraft.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SignupRequest {
    @NotBlank(message = "Full name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Enter a valid email address")
    private String email;

    @NotBlank(message = "Company is required")
    private String company;

    @NotBlank(message = "Primary role is required")
    private String role;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Use at least 8 characters")
    private String password;
}
