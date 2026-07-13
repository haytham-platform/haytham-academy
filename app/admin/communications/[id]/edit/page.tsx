import CommunicationCenterClient from "@/components/communications/CommunicationCenterClient";

export default async function EditCommunicationPage({ params }: { params: Promise<{ id: string }> }) {
  return <CommunicationCenterClient mode="edit" id={(await params).id} />;
}
