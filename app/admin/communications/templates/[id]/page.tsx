import CommunicationCenterClient from "@/components/communications/CommunicationCenterClient";

export default async function CommunicationTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  return <CommunicationCenterClient mode="template-detail" id={(await params).id} />;
}
