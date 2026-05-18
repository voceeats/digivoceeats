import OrderConfirmedClient from "./order-confirmed-client";

export default function OrderConfirmedPage({ params }: { params: { orderId: string } }) {
  return <OrderConfirmedClient orderId={params.orderId} />;
}
