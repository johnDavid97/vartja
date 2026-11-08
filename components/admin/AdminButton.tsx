import type { ComponentPropsWithRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

/** Also use these classes on links: navigation must remain a real link. */
export const adminButtonStyles = cva("admin-button", {
  variants: {
    variant: {
      primary: "admin-button--primary",
      secondary: "admin-button--secondary",
      soft: "admin-button--soft",
      ghost: "admin-button--ghost",
      danger: "admin-button--danger",
      // Cards, drag handles and image pickers retain their specialised layout.
      plain: "admin-button--plain",
    },
    size: {
      sm: "admin-button--sm",
      md: "admin-button--md",
      lg: "admin-button--lg",
      icon: "admin-button--icon",
      "icon-sm": "admin-button--icon-sm",
    },
    shape: { pill: "admin-button--pill" },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

type Props = ComponentPropsWithRef<"button"> & VariantProps<typeof adminButtonStyles> & {
  loading?: boolean;
};

/** React 19 forwards ref via props, including Base UI's popover trigger refs. */
export function AdminButton({
  variant, size, shape, className, loading = false, disabled,
  type = "button", children, ...props
}: Props) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || props["aria-busy"]}
      className={adminButtonStyles({ variant, size, shape, className })}
    >
      {loading && <span className="admin-button__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
