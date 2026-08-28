import type { ComponentType } from "react";
import { BakerIcon, FashionIcon, GiftIcon, ServiceIcon, TutorIcon } from "@/components/ui/vertical-icons";

export type VerticalKey = "fashion" | "tutor" | "service" | "baker" | "gift";

interface VerticalMeta {
  label: string;
  icon: ComponentType<{ className?: string }>;
  // Full literal class names (not string-templated) so Tailwind's content scanner can see
  // and generate them -- `bg-vertical-${key}` would silently produce no CSS at all.
  dotClass: string;
  iconBgClass: string;
  iconColorClass: string;
}

export const VERTICAL_META: Record<VerticalKey, VerticalMeta> = {
  fashion: {
    label: "Fashion",
    icon: FashionIcon,
    dotClass: "bg-vertical-fashion",
    iconBgClass: "bg-vertical-fashion/15",
    iconColorClass: "text-vertical-fashion",
  },
  tutor: {
    label: "Tutor",
    icon: TutorIcon,
    dotClass: "bg-vertical-tutor",
    iconBgClass: "bg-vertical-tutor/15",
    iconColorClass: "text-vertical-tutor",
  },
  service: {
    label: "Service",
    icon: ServiceIcon,
    dotClass: "bg-vertical-service",
    iconBgClass: "bg-vertical-service/15",
    iconColorClass: "text-vertical-service",
  },
  baker: {
    label: "Baker / Custom Cake",
    icon: BakerIcon,
    dotClass: "bg-vertical-baker",
    iconBgClass: "bg-vertical-baker/15",
    iconColorClass: "text-vertical-baker",
  },
  gift: {
    label: "Personalized Gift",
    icon: GiftIcon,
    dotClass: "bg-vertical-gift",
    iconBgClass: "bg-vertical-gift/15",
    iconColorClass: "text-vertical-gift",
  },
};
