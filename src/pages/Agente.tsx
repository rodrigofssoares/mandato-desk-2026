import { useState, useEffect, useCallback } from 'react';
import { useAgentSettings } from '@/hooks/useAgentSettings';
import { usePermissions } from '@/hooks/usePermissions';
import { useAgentPresets, getDefaultModel } from '@/hooks/useAgentPresets';
import { useAgentMessages, useSendAgentMessage } from '@/hooks/useAgentChat';
import { useAgentFavorites } from '@/hooks/useAgentFavorites';
import { useAgentSessions, useCreateAgentSession } from '@/hooks/useAgentSessions';

import { AgentHeader } from '@/components/agent/AgentHeader';
import { AgentWelcome } from '@/components/agent/AgentWelcome';
import { AgentChatMessages } from '@/components/agent/AgentChatMessages';
import { AgentInput } from '@/components/agent/AgentInput';
import { AgentDrawerSessions } from '@/components/agent/AgentDrawerSessions';
import { AgentDrawerFavorites } from '@/components/agent/AgentDrawerFavorites';
import { AgentInactiveCard } from '@/components/agent/AgentInactiveCard';
import { AgentNoAccessCard } from '@/components/agent/AgentNoAccessCard';

import { Loader2 } from 'lucide-react';

// ============================================================================
// Página principal do Agente de IA
// ============================================================================

export default function Agente() {
  const { can, isLoading: permsLoading } = usePermissions();
  const { data: agentSettings, isLoading: settingsLoading } = useAgentSettings();
  const { data: presets = [] } = useAgentPresets();
  const { data: favData } = useAgentFavorites();
  const { data: sessions = [] } = useAgentSessions();

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  const createSession = useCreateAgentSession();
  const sendMessage = useSendAgentMessage();

  const { data: messages = [], isLoading: messagesLoading } = useAgentMessages(currentSessionId);
  const favorites = favData?.data ?? [];
  const favoritesCount = favData?.count ?? 0;

  // Determina o modelo padrão do preset ativo
  const defaultModel = getDefaultModel(presets);

  // Exibe o modelo do preset ativo (seletor será implementado em onda futura)
  const currentModelLabel = defaultModel?.model_id ?? null;

  // Abre a sessão mais recente ao carregar pela primeira vez.
  // currentSessionId intencionalmente fora das deps para não cancelar "Nova conversa"
  // (quando handleNewSession seta null, o effect não deve re-setar sessions[0])
  useEffect(() => {
    if (!currentSessionId && sessions.length > 0) {
      setCurrentSessionId(sessions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const dispatchMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    let sessionId = currentSessionId;

    // Cria sessão se não há uma ativa
    if (!sessionId) {
      try {
        sessionId = await createSession.mutateAsync();
        setCurrentSessionId(sessionId);
      } catch {
        return;
      }
    }

    sendMessage.mutate({
      session_id: sessionId,
      message: trimmed,
    });
  }, [currentSessionId, createSession, sendMessage]);

  const handleSend = useCallback(async () => {
    await dispatchMessage(inputValue);
    setInputValue('');
  }, [inputValue, dispatchMessage]);

  const handleSuggestion = useCallback((prompt: string) => {
    dispatchMessage(prompt);
  }, [dispatchMessage]);

  const handleNewSession = useCallback(() => {
    setCurrentSessionId(null);
    setInputValue('');
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setCurrentSessionId(id || null);
  }, []);

  // ============================================================================
  // Loading / Guards
  // ============================================================================

  if (permsLoading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Guard: sem permissão para ver o agente
  if (!can.viewAgente()) {
    return <AgentNoAccessCard />;
  }

  // Guard: agente desativado
  if (agentSettings && !agentSettings.is_active) {
    return <AgentInactiveCard />;
  }

  const showWelcome = messages.length === 0 && !sendMessage.isPending && !messagesLoading;
  const isTyping = sendMessage.isPending;

  return (
    <div
      className="flex flex-col h-[100dvh] overflow-hidden"
      style={{
        backgroundImage: `
          radial-gradient(at 20% 0%, hsl(var(--accent) / 0.06) 0px, transparent 50%),
          radial-gradient(at 80% 100%, hsl(var(--primary) / 0.05) 0px, transparent 50%)
        `,
      }}
    >
      {/* Header institucional */}
      <AgentHeader
        agent={agentSettings ?? null}
        messages={messages}
        favoritesCount={favoritesCount}
        selectedModel={currentModelLabel}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenFavorites={() => setFavoritesOpen(true)}
      />

      {/* Área de mensagens / welcome */}
      <div className="flex-1 overflow-y-auto px-6 pt-10 pb-6 scroll-smooth [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded">
        <div className="max-w-[740px] mx-auto">
          {showWelcome && (
            <AgentWelcome
              onSelectSuggestion={handleSuggestion}
              starters={agentSettings?.conversation_starters ?? []}
            />
          )}

          {(messages.length > 0 || isTyping) && (
            <AgentChatMessages
              messages={messages}
              favorites={favorites}
              isLoading={isTyping}
            />
          )}
        </div>
      </div>

      {/* Input */}
      <AgentInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        isLoading={isTyping}
        disabled={!agentSettings?.is_active}
      />

      {/* Drawers */}
      <AgentDrawerSessions
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />

      <AgentDrawerFavorites
        open={favoritesOpen}
        onClose={() => setFavoritesOpen(false)}
      />
    </div>
  );
}
