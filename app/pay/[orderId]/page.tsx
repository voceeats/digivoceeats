import PayOrderClient from "./pay-order-client";

export default function PayOrderPage({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const cancelledRaw = searchParams.cancelled;
  const cancelled =
    cancelledRaw === "true" || (Array.isArray(cancelledRaw) && cancelledRaw[0] === "true");

  return <PayOrderClient orderId={params.orderId} cancelled={cancelled} />;
}
