"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: "string", required: false, input: false },
        status: { type: "string", required: false, input: false },
        phone: { type: "string", required: false },
        marketingOptIn: { type: "boolean", required: false },
      },
    }),
  ],
});

export const { useSession, signIn, signUp, signOut } = authClient;
