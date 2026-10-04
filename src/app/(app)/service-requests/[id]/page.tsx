import { RequestDetailClient } from "./request-detail-client";

export function generateStaticParams() {
  return [
    { id: "77777777-7777-7777-7777-777777777771" },
    { id: "77777777-7777-7777-7777-777777777772" },
    { id: "77777777-7777-7777-7777-777777777773" },
    { id: "77777777-7777-7777-7777-777777777774" },
    { id: "sr1" },
    { id: "sr2" },
    { id: "sr3" },
    { id: "sr4" },
  ];
}

export default async function ServiceRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RequestDetailClient id={id} />;
}
