import ChatInterface from "@/components/chat/ChatInterface";


export default function ChatAgentPage() {
    // Mocking the IoT parameters. In a real scenario, this could be fetched from Supabase or passed down
    const pondParameters = {
        avg_weight: 12.5, // gram
        avg_length: 10.2, // cm
        activity_level: 65, // %
    };

    return <ChatInterface parameters={pondParameters} />;
}
