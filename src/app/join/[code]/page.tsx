import { JoinRoom } from "@/components/multiplayer/JoinRoom";

type Props = {
  params: Promise<{ code: string }>;
};

export default async function JoinWithCodePage({ params }: Props) {
  const { code } = await params;
  return <JoinRoom initialCode={code} />;
}
