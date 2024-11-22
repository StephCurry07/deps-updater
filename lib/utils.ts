// lib/utils.ts

import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * A helper function to merge Tailwind CSS class names.
 * It uses clsx to conditionally join class names and tailwind-merge to handle conflicts.
 * 
 * @param inputs - Class names to merge.
 * @returns Merged class names as a string.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}