import React, { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

export default function Coach() {
  const [messages, setMessages] = useState([
    { id: 1, text: '¡Hola! Soy tu AI Coach de Resilia. Revisando la topología de tu hogar, noté que la ruta desde la cocina hacia la salida tiene un potencial cuello de botella.', isAi: true },
    { id: 2, text: '¿Sabes por qué es importante mantener los pasadizos despejados, especialmente cerca de la cocina?', isAi: true }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    
    // User message
    const userMsg = { id: Date.now(), text: input, isAi: false };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    
    // Mock AI reply
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        text: '¡Excelente razonamiento! Durante un movimiento sísmico, los objetos en la cocina (especialmente cristales o cosas calientes) pueden caer. Tener la ruta libre evita accidentes graves al evacuar. He actualizado tu competencia en "Rutas de Evacuación".', 
        isAi: true 
      }]);
    }, 1500);
  };

  return (
    <div className="coach-chat flex flex-col" style={{height: 'calc(100vh - var(--nav-height) - 48px)'}}>
      <header className="mb-4 flex items-center gap-3" style={{paddingBottom: '16px', borderBottom: '1px solid var(--border)'}}>
        <div style={{background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.5rem', borderRadius: 'var(--radius)'}}>
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="text-sm font-semibold m-0">Resilia AI Coach</h2>
          <p className="text-xs m-0">Sesión de entrenamiento contextual</p>
        </div>
      </header>

      <div className="chat-area" style={{flex: 1, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column'}}>
        {messages.map(msg => (
          <div key={msg.id} className="chat-message">
            <div className={`chat-bubble ${msg.isAi ? 'ai' : 'user'}`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input flex items-center gap-3 mt-4">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Escribe tu respuesta..."
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            background: 'var(--background)',
            outline: 'none',
            fontSize: '0.875rem'
          }}
        />
        <button 
          className="btn btn-primary" 
          style={{borderRadius: '50%', width: '40px', height: '40px', padding: 0}}
          onClick={handleSend}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
