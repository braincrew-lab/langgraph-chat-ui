'use server'

import { hash } from "bcryptjs";
import { prisma } from "@/lib/auth/prisma";
import {
  getInitialAdminEmail,
  isPublicMode,
} from "@/lib/auth/mode";
import { getSetting } from "@/lib/services/settings.service";
import type { UserRole, UserStatus, RegistrationPolicy } from "@/types/auth-mode";

// =============================================================================
// Types
// =============================================================================

export type RegisterResult =
  | {
      success: true;
      data: {
        user: { id: string; name: string | null; email: string };
        status: UserStatus;
        message?: string;
      };
    }
  | { success: false; error: string };

export interface RegisterInput {
  name?: string;
  email: string;
  password: string;
}

// =============================================================================
// Registration
// =============================================================================

/**
 * Register a new user
 */
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  try {
    const { name, email, password } = input;

    // Registration is disabled in public mode
    if (isPublicMode()) {
      return {
        success: false,
        error: "Registration is not available in public mode",
      };
    }

    // Check if registration is allowed via admin settings
    const allowRegistration = await getSetting("auth.allowRegistration");
    if (!allowRegistration) {
      return {
        success: false,
        error: "Registration is currently disabled",
      };
    }

    // Validate required fields
    if (!email || !password) {
      return {
        success: false,
        error: "Email and password are required",
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: "Invalid email format",
      };
    }

    // Validate password strength
    if (password.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters long",
      };
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return {
        success: false,
        error: "User with this email already exists",
      };
    }

    // Get registration policy from admin settings
    const registrationPolicy = (await getSetting("auth.registrationPolicy")) as RegistrationPolicy;

    // Determine user status based on registration policy
    const initialAdminEmail = getInitialAdminEmail();
    const isInitialAdmin =
      initialAdminEmail && email.toLowerCase() === initialAdminEmail.toLowerCase();

    let role: UserRole = "user";
    // Use admin setting to determine if approval is required
    let status: UserStatus = registrationPolicy === "approval" ? "pending" : "active";

    // Initial admin gets admin role and active status
    if (isInitialAdmin) {
      role = "super_admin";
      status = "active";
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: name || null,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        status,
        approvedAt: status === "active" ? new Date() : null,
      },
    });

    // Return appropriate response based on status
    const response: RegisterResult = {
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        status: user.status as UserStatus,
      },
    };

    if (status === "pending") {
      response.data.message =
        "Your account has been created and is pending approval. You will be notified when your account is approved.";
    }

    return response;
  } catch (error) {
    console.error("Registration error:", error);
    return {
      success: false,
      error: "An error occurred during registration",
    };
  }
}
