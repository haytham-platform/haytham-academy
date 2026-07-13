import CommunicationCenterClient from "@/components/communications/CommunicationCenterClient";

export default async function CommunicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <CommunicationCenterClient mode="detail" id={(await params).id} />;
}
