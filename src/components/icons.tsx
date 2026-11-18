import { Utensils, House, BusFront, Clapperboard, BriefcaseBusiness, ShoppingBag, Shapes } from "lucide-react";
import type { Category } from "@/lib/finance";
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "brand-small" : ""}`}>
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="32" height="32" rx="10" fill="#2d684d" />
        <path
          d="M11 25V9h6.5a5.5 5.5 0 1 1 0 11H15"
          stroke="white"
          strokeWidth="3.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M16 9v6h4" stroke="#c4dfba" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!small && (
        <span>
          penny<span className="brand-period">.</span>
        </span>
      )}
    </div>
  );
}
export function CategoryIcon({ category, size = 17 }: { category: Category; size?: number }) {
  const Icon =
    {
      Food: Utensils,
      Rent: House,
      Transport: BusFront,
      Entertainment: Clapperboard,
      Salary: BriefcaseBusiness,
      Shopping: ShoppingBag,
      Other: Shapes,
    }[category] || Shapes;
  return <Icon size={size} strokeWidth={1.7} />;
}
export function PlantIllustration() {
  return (
    <svg viewBox="0 0 150 95" className="plant-illustration" fill="none" aria-hidden="true">
      <ellipse cx="76" cy="85" rx="46" ry="4" fill="#dbe7d8" />
      <path d="M60 58h32l-5 25H65l-5-25Z" fill="#d0deca" stroke="#6d9273" strokeWidth="1.5" />
      <path d="M76 58V24M76 43 59 31M76 35l17-14" stroke="#426f4e" strokeWidth="2" strokeLinecap="round" />
      <path d="M76 35c-12 0-20-8-20-19 13 0 20 7 20 19Z" fill="#9cbb96" stroke="#426f4e" strokeWidth="1.5" />
      <path d="M77 28c0-14 9-22 22-22-1 14-9 22-22 22Z" fill="#b9d0a9" stroke="#426f4e" strokeWidth="1.5" />
      <path d="M75 49c-12 0-22-7-23-17 14-1 23 7 23 17Z" fill="#b9d0a9" stroke="#426f4e" strokeWidth="1.5" />
      <circle cx="42" cy="52" r="10" fill="#f1e7b9" stroke="#b3a15c" strokeWidth="1.5" />
      <path d="M42 46v12m3-9c-6-4-9 4-3 4 6 0 3 6-3 3" stroke="#b3a15c" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M112 46v8m-4-4h8M34 17v6m-3-3h6" stroke="#91aa83" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
