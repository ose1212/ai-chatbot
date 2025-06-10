'use client';

// ALTE VERSION (auskommentiert, weil nicht Assistants API kompatibel)
/*
import type { Attachment, UIMessage } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
*/

import React, { useState } from 'react';

export function Chat() {
  // States
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');

  // Assistants API Call
  const runAssistant = async (userMessage: string) => {
    const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY as string;
    const OPENAI_ASSISTANT_ID = process.env.NEXT_PUBLIC_OPENAI_ASSISTANT_ID as string;

    // 1️⃣ Create thread
    const threadRes = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({}),
    });
    const threadData = await threadRes.json();
    const threadId = threadData.id;

    // 2️⃣ Add message
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        role: 'user',
        content: userMessage,
      }),
    });

    // 3️⃣ Start run
    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        assistant_id: OPENAI_ASSISTANT_ID,
      }),
    });
    const runData = await runRes.json();
    const runId = runData.id;

    // 4️⃣ Poll run status
    let runStatus = 'in_progress';
    while (runStatus === 'in_progress' || runStatus === 'queued') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const checkRunRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      const runCheckData = await checkRunRes.json();
      runStatus = runCheckData.status;
    }

    // 5️⃣ Get messages
    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
    });
    const messagesData = await messagesRes.json();
    const lastMessage = messagesData.data[0].content[0].text.value;
    return lastMessage;
  };

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages([...messages, { role: 'user', content: userMessage }]);
    setInput('');
    setStatus('loading');

    try {
      const botResponse = await runAssistant(userMessage);
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: botResponse },
      ]);
    } catch (error) {
      console.error('Assistant API error:', error);
    }

    setStatus('idle');
  };

  // Simple Chat UI
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <h1>Leadership GPT Chatbot</h1>
      <div
        style={{
          border: '1px solid #ccc',
          padding: '1rem',
          height: '400px',
          overflowY: 'scroll',
          marginBottom: '1rem',
        }}
      >
        {messages.map((msg, index) => (
          <div key={index} style={{ marginBottom: '0.5rem' }}>
            <strong>{msg.role === 'user' ? 'You:' : 'Assistant:'}</strong> {msg.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1, padding: '0.5rem' }}
          placeholder="Type your message..."
          disabled={status === 'loading'}
        />
        <button type="submit" disabled={status === 'loading'}>
          Send
        </button>
      </form>
    </div>
  );
}
