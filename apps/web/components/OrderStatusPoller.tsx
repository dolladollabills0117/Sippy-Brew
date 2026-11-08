"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";

/** Refreshes the page when the shop moves the order along (received → preparing → ready → picked up). */
export function OrderStatusPoller({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  useEffect(() => {
    if (status === "picked_up" || status === "cancelled") return;
    const id = setInterval(async () => {
      try {
        const { order } = await api.getOrder(orderId);
        if (order.status !== status) router.refresh();
      } catch {
        /* offline: try again next tick */
      }
    }, 8000);
    return () => clearInterval(id);
  }, [orderId, status, router]);
  return null;
}
