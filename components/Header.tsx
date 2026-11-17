import Link from "next/link";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

const links = [
  { href: "/", label: "Hjem" },
  { href: "/news", label: "Innlegg" },
  { href: "/program", label: "Program" },
  { href: "/reiseplan", label: "Reiseplan" },
  { href: "/ting-a-gjore", label: "Ting å gjøre" },
  { href: "/bilder", label: "Bilder" },
  { href: "/wedding-party", label: "Wedding Party" },
];

export default function Header() {
  return (
    <header className="flex flex-wrap items-center justify-end gap-4 p-6">
      <NavigationMenu aria-label="Hovedmeny">
        <NavigationMenuList className="flex-wrap justify-center">
          {links.map(({ href, label }) => (
            <NavigationMenuItem key={href}>
              <NavigationMenuLink
                render={<Link href={href} />}
                className={navigationMenuTriggerStyle()}
              >
                {label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          ))}
        </NavigationMenuList>
      </NavigationMenu>
      <Button
        variant="outline"
        disabled
        aria-label="Språk: Norsk. Engelsk kommer snart."
        title="Engelsk kommer snart"
      >
        <Languages aria-hidden="true" />
        NO / EN
      </Button>
    </header>
  );
}
