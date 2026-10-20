"use client";

import { createContext, useContext } from "react";

const PeriodContext = createContext<number>(1);

export const PeriodProvider = PeriodContext.Provider;

/** Day of the month a budget "month" starts on (1 = calendar month). */
export function usePeriodStart(): number {
  return useContext(PeriodContext);
}
