import PayCodeClient from "./pay-code-client";

export default function PayPage({
  searchParams,
}: {
  searchParams: { success?: string };
}) {
  return <PayCodeClient isSuccess={searchParams.success === "1"} />;
}
