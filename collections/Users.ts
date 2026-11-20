import type { CollectionConfig } from "payload";
import { privateFirstRegisterEndpoint } from "../features/admin-security/bootstrap";
import { validateAdministratorPassword, ADMIN_PASSWORD_MIN_LENGTH } from "../features/admin-security/password";
import { resolveAdminSiteSecurity } from "../features/admin-security/site-origin";

const { secureCookies } = resolveAdminSiteSecurity(process.env.PUBLIC_SITE_URL, process.env.NODE_ENV);

// Only the couple's trusted editors have accounts. There is no public signup.
export const Users: CollectionConfig = {
  slug: "users",
  auth: {
    cookies: {
      sameSite: "Lax",
      secure: secureCookies,
    },
  },
  labels: { singular: "Redaktør", plural: "Redaktører" },
  // Collection endpoints are kept before Payload's native auth endpoints during sanitization.
  endpoints: [privateFirstRegisterEndpoint],
  admin: {
    useAsTitle: "name", group: "Innstillinger", hideAPIURL: true,
    defaultColumns: ["name", "email", "updatedAt"],
    listSearchableFields: ["name", "email"],
    components: { views: { list: { Component: "/components/admin/tables/AdminList#default" } } },
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: "name", label: "Navn", type: "text", required: true, admin: { components: { Cell: "/components/admin/tables/Cells#TitleCell" } } },
    // Payload recognizes this as an override for its native auth password input. Keeping it
    // virtual and hidden avoids storage/schema changes and a duplicate document field.
    {
      name: "password",
      label: "Passord",
      type: "text",
      virtual: true,
      hidden: true,
      minLength: ADMIN_PASSWORD_MIN_LENGTH,
      validate: validateAdministratorPassword,
    },
  ],
};
