import { DeviceDetailClient } from "./device-detail-client";

export function generateStaticParams() {
  return [
    { id: "55555555-5555-5555-5555-555555555551" },
    { id: "55555555-5555-5555-5555-555555555552" },
    { id: "55555555-5555-5555-5555-555555555553" },
    { id: "55555555-5555-5555-5555-555555555554" },
    { id: "d1" },
    { id: "d2" },
    { id: "d3" },
    { id: "d4" },
  ];
}

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DeviceDetailClient id={id} />;
}
