import { BedDouble, Bus, Heart, Info, Plane, TrainFront } from "lucide-react";
import type { ProgramKind } from "@/lib/program";

const icons = { flight: Plane, train: TrainFront, bus: Bus, hotel: BedDouble, event: Heart, info: Info };

export function ProgramKindIcon({ kind, size = 21 }: { kind: ProgramKind; size?: number }) {
  const Icon = icons[kind];
  return <Icon size={size} aria-hidden="true" />;
}
