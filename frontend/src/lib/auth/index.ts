import { usesNextAuth } from "@/types/auth-mode";
import type { Session } from "next-auth";
import type { NextRequest } from "next/server";

type AuthFunction = () => Promise<Session | null>;
type HandlersType = {
  GET: (req: NextRequest) => Promise<Response>;
  POST: (req: NextRequest) => Promise<Response>;
};

// standalone/oauth-direct 모드에서는 NextAuth 초기화 안함
const needsAuth = usesNextAuth();

let handlers: HandlersType;
let auth: AuthFunction;
let signIn: typeof import("next-auth/react").signIn;
let signOut: typeof import("next-auth/react").signOut;

if (needsAuth) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const NextAuth = require("next-auth").default;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { authConfig } = require("./config");
  const nextAuth = NextAuth(authConfig);
  handlers = nextAuth.handlers;
  auth = nextAuth.auth;
  signIn = nextAuth.signIn;
  signOut = nextAuth.signOut;
} else {
  handlers = {
    GET: async () => new Response("Not available", { status: 404 }),
    POST: async () => new Response("Not available", { status: 404 }),
  };
  auth = async () => null;
  signIn = (async () => undefined) as typeof signIn;
  signOut = (async () => undefined) as typeof signOut;
}

export { handlers, auth, signIn, signOut };
