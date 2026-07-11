import type { OrderLine } from "@/lib/types";

/** A cart line is an order line before it's assigned a batch number. */
export type CartLine = Omit<OrderLine, "batch">;
