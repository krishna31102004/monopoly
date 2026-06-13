import { JoinRoom } from "@/components/multiplayer/JoinRoom";

type Props = {
  params: Promise<{ code: string }>;
};

// Deep-link entry for /room/LONDON-4821 — pre-fills the join form with the code
export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  return <JoinRoom initialCode={code} />;
}
