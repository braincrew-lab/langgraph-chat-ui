import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/auth/prisma";
import {
  getNewUserStatus,
  getInitialAdminEmail,
  isPublicMode,
} from "@/lib/auth/mode";
import { getSetting } from "@/lib/services/settings.service";
import type { UserRole, UserStatus } from "@/types/auth-mode";

export async function POST(req: NextRequest) {
  try {
    // Registration is disabled in public mode
    if (isPublicMode()) {
      return NextResponse.json(
        { error: "Registration is not available in public mode" },
        { status: 403 }
      );
    }

    // Check if registration is allowed via admin settings
    const allowRegistration = await getSetting("auth.allowRegistration");
    if (!allowRegistration) {
      return NextResponse.json(
        { error: "Registration is currently disabled" },
        { status: 403 }
      );
    }

    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Determine user status based on registration policy
    const initialAdminEmail = getInitialAdminEmail();
    const isInitialAdmin =
      initialAdminEmail && email.toLowerCase() === initialAdminEmail.toLowerCase();

    let role: UserRole = "user";
    let status: UserStatus = getNewUserStatus();

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
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        status,
        approvedAt: status === "active" ? new Date() : null,
      },
    });

    // Return appropriate response based on status
    const response: {
      user: { id: string; name: string | null; email: string };
      status: UserStatus;
      message?: string;
    } = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      status: user.status as UserStatus,
    };

    if (status === "pending") {
      response.message =
        "Your account has been created and is pending approval. You will be notified when your account is approved.";
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
